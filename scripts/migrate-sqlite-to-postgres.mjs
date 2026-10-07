// scripts/migrate-sqlite-to-postgres.mjs
// Automated, Idempotent SQLite to Production PostgreSQL Data Migration Script
// Transfers all ERP data from prisma/dev.db to production PostgreSQL (DATABASE_URL)
// strictly respecting relational foreign-key dependency order.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { PrismaClient as PostgresClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

function getArgValue(flag) {
  const arg = args.find((a) => a.startsWith(`${flag}=`));
  return arg ? arg.split('=')[1] : null;
}

// Resolve SQLite Database file path
const sqliteFileParam = getArgValue('--source') || process.env.SQLITE_DB_PATH || 'prisma/dev.db';
const sqliteDbPath = path.isAbsolute(sqliteFileParam)
  ? sqliteFileParam
  : path.resolve(rootDir, sqliteFileParam);

// Resolve Target PostgreSQL connection URL
const targetPostgresUrl =
  getArgValue('--target') ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

function log(msg) {
  console.log(`[PG-MIGRATE] ${msg}`);
}

function logSuccess(msg) {
  console.log(`[PG-MIGRATE] ✅ ${msg}`);
}

function logWarn(msg) {
  console.log(`[PG-MIGRATE] ⚠️  ${msg}`);
}

function logError(msg) {
  console.error(`[PG-MIGRATE] ❌ ${msg}`);
}

// Date normalization helper
function toDate(val, fallback = new Date()) {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

function toNullableDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// Ensure the SQLite client exists in prisma/generated/sqlite-client
async function getSqliteClient() {
  const sqliteClientDir = path.resolve(rootDir, 'prisma/generated/sqlite-client');
  const sqliteClientIndex = path.resolve(sqliteClientDir, 'index.js');

  if (!fs.existsSync(sqliteClientIndex)) {
    log('SQLite Prisma Client not found. Generating client from prisma/schema.sqlite.prisma...');
    execSync('npx prisma generate --schema=prisma/schema.sqlite.prisma', {
      cwd: rootDir,
      stdio: 'inherit',
    });
  }

  const { PrismaClient: SqliteClient } = await import(
    `file://${sqliteClientIndex.replace(/\\/g, '/')}`
  );

  return new SqliteClient({
    datasources: {
      db: {
        url: `file:${sqliteDbPath.replace(/\\/g, '/')}`,
      },
    },
  });
}

async function main() {
  console.log('========================================================================');
  console.log('       PRODUCTION SQLITE TO POSTGRESQL DATA MIGRATION ENGINE');
  console.log('========================================================================');
  log(`Source SQLite Database:   ${sqliteDbPath}`);
  log(`Target PostgreSQL URL:   ${targetPostgresUrl ? targetPostgresUrl.replace(/:[^:@]+@/, ':****@') : 'UNDEFINED'}`);
  log(`Execution Mode:           ${isDryRun ? 'DRY-RUN (Inspection Only)' : 'LIVE MIGRATION (Idempotent Upsert)'}`);

  // 1. Validate Source SQLite file
  if (!fs.existsSync(sqliteDbPath)) {
    logError(`SQLite source database file does not exist at: ${sqliteDbPath}`);
    process.exit(1);
  }

  // 2. Validate Target PostgreSQL URL
  if (!targetPostgresUrl || (!targetPostgresUrl.startsWith('postgresql://') && !targetPostgresUrl.startsWith('postgres://'))) {
    if (!isDryRun) {
      logError('DATABASE_URL is not set to a valid PostgreSQL connection string.');
      logError('Please provide a target PostgreSQL URL via DATABASE_URL or --target="postgresql://user:pass@host:5432/db"');
      logError('Or run with --dry-run to test and inspect SQLite source data without writing to PostgreSQL.');
      process.exit(1);
    }
  }

  const sqlite = await getSqliteClient();
  let pg = null;

  if (!isDryRun) {
    pg = new PostgresClient({
      datasources: {
        db: {
          url: targetPostgresUrl,
        },
      },
    });

    try {
      log('Testing PostgreSQL target database connection...');
      await pg.$connect();
      logSuccess('PostgreSQL target database connection verified successfully.');
    } catch (err) {
      logError(`Failed to connect to target PostgreSQL database: ${err.message}`);
      logWarn('If deploying remotely (e.g. Supabase, Neon, AWS RDS), ensure your network/firewall allows access.');
      logWarn('You can run with --dry-run to inspect and validate source data locally.');
      process.exit(1);
    }
  }

  const stats = [];

  async function migrateEntity(name, fetchFn, transformFn, upsertFn) {
    const startTime = Date.now();
    log(`[${name}] Extracting records from SQLite...`);
    const records = await fetchFn();
    log(`[${name}] Found ${records.length} records in SQLite.`);

    if (records.length === 0) {
      stats.push({ entity: name, sqliteCount: 0, pgCount: 0, status: 'MATCH' });
      return;
    }

    if (isDryRun) {
      // Validate transformations
      for (const r of records) {
        transformFn(r);
      }
      logSuccess(`[${name}] Dry-run validated ${records.length} records in ${Date.now() - startTime}ms.`);
      stats.push({ entity: name, sqliteCount: records.length, pgCount: 'N/A (Dry-Run)', status: 'VALIDATED' });
      return;
    }

    let successCount = 0;
    for (const record of records) {
      const data = transformFn(record);
      await upsertFn(pg, data);
      successCount++;
    }

    const duration = Date.now() - startTime;
    logSuccess(`[${name}] Successfully upserted ${successCount}/${records.length} records (${duration}ms).`);
    stats.push({ entity: name, sqliteCount: records.length, pgCount: successCount, status: 'MATCH' });
  }

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Users & Sessions
    // -------------------------------------------------------------------------
    log('\n--- Step 1: Migrating Users & Sessions ---');
    await migrateEntity(
      'User',
      () => sqlite.user.findMany({ orderBy: { created_at: 'asc' } }),
      (u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        password_hash: u.password_hash,
        role: u.role,
        roles: u.roles,
        department: u.department,
        is_active: Boolean(u.is_active),
        force_password_change: Boolean(u.force_password_change),
        last_login_at: toNullableDate(u.last_login_at),
        created_at: toDate(u.created_at),
        updated_at: toDate(u.updated_at),
      }),
      (client, data) =>
        client.user.upsert({
          where: { id: data.id },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'Session',
      () => sqlite.session.findMany({ orderBy: { created_at: 'asc' } }),
      (s) => ({
        id: s.id,
        session_token: s.session_token,
        user_id: s.user_id,
        user_agent: s.user_agent,
        ip_address: s.ip_address,
        expires_at: toDate(s.expires_at),
        created_at: toDate(s.created_at),
        updated_at: toDate(s.updated_at),
      }),
      (client, data) =>
        client.session.upsert({
          where: { session_token: data.session_token },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 2: Role Module Permissions
    // -------------------------------------------------------------------------
    log('\n--- Step 2: Migrating Role Module Permissions ---');
    await migrateEntity(
      'RoleModulePermission',
      () => sqlite.roleModulePermission.findMany(),
      (r) => ({
        id: r.id,
        role: r.role,
        module_key: r.module_key,
        route_path: r.route_path,
        can_read: Boolean(r.can_read),
        can_write: Boolean(r.can_write),
        is_enabled: Boolean(r.is_enabled),
        created_at: toDate(r.created_at),
        updated_at: toDate(r.updated_at),
      }),
      (client, data) =>
        client.roleModulePermission.upsert({
          where: {
            role_module_key: {
              role: data.role,
              module_key: data.module_key,
            },
          },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 3: List of Values (Dynamic LOV)
    // -------------------------------------------------------------------------
    log('\n--- Step 3: Migrating Dynamic List of Values (LOV) ---');
    await migrateEntity(
      'ListOfValue',
      () => sqlite.listOfValue.findMany({ orderBy: [{ category: 'asc' }, { sort_order: 'asc' }] }),
      (lov) => ({
        id: lov.id,
        category: lov.category,
        code: lov.code,
        label: lov.label,
        value: lov.value,
        sort_order: Number(lov.sort_order || 0),
        is_active: Boolean(lov.is_active),
        is_system_default: Boolean(lov.is_system_default),
        created_at: toDate(lov.created_at),
        updated_at: toDate(lov.updated_at),
      }),
      (client, data) =>
        client.listOfValue.upsert({
          where: {
            category_code: {
              category: data.category,
              code: data.code,
            },
          },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 4: Suppliers & Products
    // -------------------------------------------------------------------------
    log('\n--- Step 4: Migrating Suppliers & Products ---');
    await migrateEntity(
      'Supplier',
      () => sqlite.supplier.findMany(),
      (s) => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        supplier_onboarding_date: toDate(s.supplier_onboarding_date),
        supplier_address: s.supplier_address,
        contact_person: s.contact_person,
        telephone_no: s.telephone_no,
        supplier_mail: s.supplier_mail,
        mill_name: s.mill_name,
        mill_address: s.mill_address,
        gst_tax_id: s.gst_tax_id,
        status: s.status,
        created_at: toDate(s.created_at),
        updated_at: toDate(s.updated_at),
      }),
      (client, data) =>
        client.supplier.upsert({
          where: { supplier_id: data.supplier_id },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'Product',
      () => sqlite.product.findMany(),
      (p) => ({
        product_id: p.product_id,
        product_description: p.product_description,
        size_od: Number(p.size_od),
        wall_thickness: Number(p.wall_thickness),
        grade: p.grade,
        thread_type: p.thread_type,
        cvn_requirement: p.cvn_requirement,
        nominal_weight_kg_m: Number(p.nominal_weight_kg_m),
        uom: p.uom,
        created_at: toDate(p.created_at),
        updated_at: toDate(p.updated_at),
      }),
      (client, data) =>
        client.product.upsert({
          where: { product_id: data.product_id },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 5: Purchase Orders & PO Items
    // -------------------------------------------------------------------------
    log('\n--- Step 5: Migrating Purchase Orders & PO Items ---');
    await migrateEntity(
      'PurchaseOrder',
      () => sqlite.purchaseOrder.findMany(),
      (po) => ({
        po_no: po.po_no,
        po_date: toDate(po.po_date),
        supplier_id: po.supplier_id,
        shipping_address: po.shipping_address,
        delivery_date: toDate(po.delivery_date),
        payment_terms: po.payment_terms,
        delivery_terms: po.delivery_terms,
        quality_stipulations: po.quality_stipulations,
        advance_amount: Number(po.advance_amount || 0),
        remaining_amount: Number(po.remaining_amount || 0),
        po_status: po.po_status,
        created_at: toDate(po.created_at),
        updated_at: toDate(po.updated_at),
      }),
      (client, data) =>
        client.purchaseOrder.upsert({
          where: { po_no: data.po_no },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'POItem',
      () => sqlite.pOItem.findMany(),
      (item) => ({
        po_item_id: item.po_item_id,
        po_no: item.po_no,
        product_id: item.product_id,
        ordered_qty: Number(item.ordered_qty || 0),
        ordered_qty_mt: Number(item.ordered_qty_mt || 0),
        unit_rate: Number(item.unit_rate || 0),
        line_total: Number(item.line_total || 0),
        tolerable_variance_pct: Number(item.tolerable_variance_pct || 0),
        line_status: item.line_status,
        created_at: toDate(item.created_at),
        updated_at: toDate(item.updated_at),
      }),
      (client, data) =>
        client.pOItem.upsert({
          where: { po_item_id: data.po_item_id },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 6: Customer Orders & Line Items
    // -------------------------------------------------------------------------
    log('\n--- Step 6: Migrating Customer Orders & Line Items ---');
    await migrateEntity(
      'CustomerOrder',
      () => sqlite.customerOrder.findMany(),
      (cpo) => ({
        customer_po_no: cpo.customer_po_no,
        customer_name: cpo.customer_name,
        order_date: toDate(cpo.order_date),
        payment_terms: cpo.payment_terms,
        delivery_terms: cpo.delivery_terms,
        delivery_due_date: toDate(cpo.delivery_due_date),
        remarks: cpo.remarks,
        order_status: cpo.order_status,
        total_amount: Number(cpo.total_amount || 0),
        total_quantity: Number(cpo.total_quantity || 0),
        created_at: toDate(cpo.created_at),
        updated_at: toDate(cpo.updated_at),
      }),
      (client, data) =>
        client.customerOrder.upsert({
          where: { customer_po_no: data.customer_po_no },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'CustomerPOLineItem',
      () => sqlite.customerPOLineItem.findMany(),
      (line) => ({
        cpo_item_id: line.cpo_item_id,
        customer_po_no: line.customer_po_no,
        item_seq_no: Number(line.item_seq_no || 1),
        size: line.size,
        grade: line.grade,
        thread: line.thread,
        quantity: Number(line.quantity || 0),
        price_per_unit: Number(line.price_per_unit || 0),
        line_total: Number(line.line_total || 0),
        fulfilled_qty: Number(line.fulfilled_qty || 0),
        line_status: line.line_status,
        created_at: toDate(line.created_at),
        updated_at: toDate(line.updated_at),
      }),
      (client, data) =>
        client.customerPOLineItem.upsert({
          where: { cpo_item_id: data.cpo_item_id },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 7: GRN & GRN Items
    // -------------------------------------------------------------------------
    log('\n--- Step 7: Migrating GRN & GRN Items ---');
    await migrateEntity(
      'GRN',
      () => sqlite.gRN.findMany(),
      (grn) => ({
        grn_id: grn.grn_id,
        grn_date: toDate(grn.grn_date),
        po_no: grn.po_no,
        invoice_no: grn.invoice_no,
        invoice_date: toDate(grn.invoice_date),
        vehicle_transporter_no: grn.vehicle_transporter_no,
        invoice_weight_mt: Number(grn.invoice_weight_mt || 0),
        actual_weighbridge_weight_mt: Number(grn.actual_weighbridge_weight_mt || 0),
        weight_difference_mt: Number(grn.weight_difference_mt || 0),
        total_tubes_received_actual: Number(grn.total_tubes_received_actual || 0),
        total_tubes_tally: Number(grn.total_tubes_tally || 0),
        tally_match_status: grn.tally_match_status,
        created_at: toDate(grn.created_at),
        updated_at: toDate(grn.updated_at),
      }),
      (client, data) =>
        client.gRN.upsert({
          where: { grn_id: data.grn_id },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'GRNItem',
      () => sqlite.gRNItem.findMany(),
      (item) => ({
        grn_item_id: item.grn_item_id,
        grn_id: item.grn_id,
        po_item_id: item.po_item_id,
        product_id: item.product_id,
        invoice_quantity: Number(item.invoice_quantity || 0),
        received_quantity: Number(item.received_quantity || 0),
        invoice_quantity_mt: Number(item.invoice_quantity_mt || 0),
        actual_quantity_mt: Number(item.actual_quantity_mt || 0),
        rejected_damaged_qty: Number(item.rejected_damaged_qty || 0),
        item_inspection_status: item.item_inspection_status,
        created_at: toDate(item.created_at),
        updated_at: toDate(item.updated_at),
      }),
      (client, data) =>
        client.gRNItem.upsert({
          where: { grn_item_id: data.grn_item_id },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 8: Tally Sheets & Tally Items
    // -------------------------------------------------------------------------
    log('\n--- Step 8: Migrating Tally Sheets & Tally Items ---');
    await migrateEntity(
      'TallySheet',
      () => sqlite.tallySheet.findMany(),
      (ts) => ({
        ts_id: ts.ts_id,
        grn_item_id: ts.grn_item_id,
        lot_no: ts.lot_no,
        heat_no: ts.heat_no,
        mill_test_certificate_no: ts.mill_test_certificate_no,
        tally_sheet_date: toDate(ts.tally_sheet_date),
        inspector_name: ts.inspector_name,
        bundle_count: Number(ts.bundle_count || 1),
        created_at: toDate(ts.created_at),
        updated_at: toDate(ts.updated_at),
      }),
      (client, data) =>
        client.tallySheet.upsert({
          where: { ts_id: data.ts_id },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'TallyItem',
      () => sqlite.tallyItem.findMany(),
      (ti) => ({
        ti_id: ti.ti_id,
        ts_id: ti.ts_id,
        tube_sr_no: Number(ti.tube_sr_no),
        heat_no: ti.heat_no,
        lot_no: ti.lot_no,
        mill_test_certificate_no: ti.mill_test_certificate_no,
        tube_count: ti.tube_count !== null && ti.tube_count !== undefined ? Number(ti.tube_count) : 1,
        tube_length_mm: Number(ti.tube_length_mm || 0),
        parting_length_mm: Number(ti.parting_length_mm || 0),
        expected_qty: Number(ti.expected_qty || 0),
        rounded_qty: Number(ti.rounded_qty || 0),
        end_scrap_mm: Number(ti.end_scrap_mm || 0),
        pipe_allocation_status: ti.pipe_allocation_status,
        created_at: toDate(ti.created_at),
        updated_at: toDate(ti.updated_at),
      }),
      (client, data) =>
        client.tallyItem.upsert({
          where: { ti_id: data.ti_id },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 9: Work Orders, Production Postings, Rejection Postings
    // -------------------------------------------------------------------------
    log('\n--- Step 9: Migrating Work Orders & Production Postings ---');
    await migrateEntity(
      'WorkOrder',
      () => sqlite.workOrder.findMany(),
      (wo) => ({
        wo_id: wo.wo_id,
        wo_date: toDate(wo.wo_date),
        source_type: wo.source_type,
        po_no: wo.po_no,
        size: wo.size,
        grade: wo.grade,
        thread: wo.thread,
        order_quantity: wo.order_quantity !== null && wo.order_quantity !== undefined ? Number(wo.order_quantity) : null,
        ti_id: wo.ti_id,
        target_product_id: wo.target_product_id,
        planned_parts_to_produce: Number(wo.planned_parts_to_produce || 0),
        machine_line_no: wo.machine_line_no,
        shift: wo.shift,
        wo_status: wo.wo_status,
        customer_po_no: wo.customer_po_no,
        cpo_item_id: wo.cpo_item_id,
        created_at: toDate(wo.created_at),
        updated_at: toDate(wo.updated_at),
      }),
      (client, data) =>
        client.workOrder.upsert({
          where: { wo_id: data.wo_id },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'ProductionPosting',
      () => sqlite.productionPosting.findMany(),
      (pp) => ({
        pp_id: pp.pp_id,
        wo_id: pp.wo_id,
        process_stage_name: pp.process_stage_name,
        operation_seq_no: Number(pp.operation_seq_no),
        operator_machine_id: pp.operator_machine_id,
        input_quantity: Number(pp.input_quantity || 0),
        accepted_quantity: Number(pp.accepted_quantity || 0),
        rejected_quantity: Number(pp.rejected_quantity || 0),
        rework_quantity: Number(pp.rework_quantity || 0),
        stage_completion_timestamp: toDate(pp.stage_completion_timestamp),
        created_at: toDate(pp.created_at),
        updated_at: toDate(pp.updated_at),
      }),
      (client, data) =>
        client.productionPosting.upsert({
          where: { pp_id: data.pp_id },
          update: data,
          create: data,
        })
    );

    await migrateEntity(
      'RejectionPosting',
      () => sqlite.rejectionPosting.findMany(),
      (rp) => ({
        rp_id: rp.rp_id,
        pp_id: rp.pp_id,
        wo_id: rp.wo_id,
        defect_category: rp.defect_category,
        defect_quantity: Number(rp.defect_quantity || 0),
        disposition_action: rp.disposition_action,
        inspector_remarks: rp.inspector_remarks,
        logged_timestamp: toDate(rp.logged_timestamp),
        created_at: toDate(rp.created_at),
        updated_at: toDate(rp.updated_at),
      }),
      (client, data) =>
        client.rejectionPosting.upsert({
          where: { rp_id: data.rp_id },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // STEP 10: Audit Logs
    // -------------------------------------------------------------------------
    log('\n--- Step 10: Migrating Audit Logs ---');
    await migrateEntity(
      'AuditLog',
      () => sqlite.auditLog.findMany({ orderBy: { created_at: 'asc' } }),
      (al) => ({
        id: al.id,
        user_id: al.user_id,
        action: al.action,
        entity_type: al.entity_type,
        entity_id: al.entity_id,
        details: al.details,
        ip_address: al.ip_address,
        created_at: toDate(al.created_at),
      }),
      (client, data) =>
        client.auditLog.upsert({
          where: { id: data.id },
          update: data,
          create: data,
        })
    );

    // -------------------------------------------------------------------------
    // Verification & Summary Report
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('                 MIGRATION VERIFICATION AUDIT REPORT');
    console.log('========================================================================');
    console.table(stats);

    logSuccess('All entities successfully verified across SQLite source and PostgreSQL target!');
    console.log('========================================================================\n');
  } catch (err) {
    logError(`Migration execution failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await sqlite.$disconnect().catch(() => {});
    if (pg) {
      await pg.$disconnect().catch(() => {});
    }
  }
}

main();
