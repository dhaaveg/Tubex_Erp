-- CreateTable
CREATE TABLE "Supplier" (
    "supplier_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "supplier_onboarding_date" TIMESTAMP(3) NOT NULL,
    "supplier_address" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "telephone_no" TEXT NOT NULL,
    "supplier_mail" TEXT NOT NULL,
    "mill_name" TEXT NOT NULL,
    "mill_address" TEXT NOT NULL,
    "gst_tax_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "Product" (
    "product_id" TEXT NOT NULL,
    "product_description" TEXT NOT NULL,
    "size_od" DOUBLE PRECISION NOT NULL,
    "wall_thickness" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "thread_type" TEXT NOT NULL,
    "cvn_requirement" TEXT NOT NULL,
    "nominal_weight_kg_m" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "po_no" TEXT NOT NULL,
    "po_date" TIMESTAMP(3) NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "shipping_address" TEXT NOT NULL,
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "payment_terms" TEXT NOT NULL,
    "delivery_terms" TEXT DEFAULT 'FOB Mill Yard',
    "quality_stipulations" TEXT,
    "advance_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "remaining_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "po_status" TEXT NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("po_no")
);

-- CreateTable
CREATE TABLE "POItem" (
    "po_item_id" TEXT NOT NULL,
    "po_no" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "ordered_qty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ordered_qty_mt" DOUBLE PRECISION NOT NULL,
    "unit_rate" DOUBLE PRECISION NOT NULL,
    "line_total" DOUBLE PRECISION NOT NULL,
    "tolerable_variance_pct" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "line_status" TEXT NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POItem_pkey" PRIMARY KEY ("po_item_id")
);

-- CreateTable
CREATE TABLE "GRN" (
    "grn_id" TEXT NOT NULL,
    "grn_date" TIMESTAMP(3) NOT NULL,
    "po_no" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "vehicle_transporter_no" TEXT NOT NULL,
    "invoice_weight_mt" DOUBLE PRECISION NOT NULL,
    "actual_weighbridge_weight_mt" DOUBLE PRECISION NOT NULL,
    "weight_difference_mt" DOUBLE PRECISION NOT NULL,
    "total_tubes_received_actual" INTEGER NOT NULL DEFAULT 0,
    "total_tubes_tally" INTEGER NOT NULL DEFAULT 0,
    "tally_match_status" TEXT NOT NULL DEFAULT 'Mismatch',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRN_pkey" PRIMARY KEY ("grn_id")
);

-- CreateTable
CREATE TABLE "GRNItem" (
    "grn_item_id" TEXT NOT NULL,
    "grn_id" TEXT NOT NULL,
    "po_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "invoice_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "received_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "invoice_quantity_mt" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "actual_quantity_mt" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "rejected_damaged_qty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "item_inspection_status" TEXT NOT NULL DEFAULT 'Pending QA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRNItem_pkey" PRIMARY KEY ("grn_item_id")
);

-- CreateTable
CREATE TABLE "TallySheet" (
    "ts_id" TEXT NOT NULL,
    "grn_item_id" TEXT NOT NULL,
    "lot_no" TEXT,
    "heat_no" TEXT,
    "mill_test_certificate_no" TEXT,
    "tally_sheet_date" TIMESTAMP(3) NOT NULL,
    "inspector_name" TEXT NOT NULL,
    "bundle_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TallySheet_pkey" PRIMARY KEY ("ts_id")
);

-- CreateTable
CREATE TABLE "TallyItem" (
    "ti_id" TEXT NOT NULL,
    "ts_id" TEXT NOT NULL,
    "tube_sr_no" INTEGER NOT NULL,
    "heat_no" TEXT,
    "lot_no" TEXT,
    "mill_test_certificate_no" TEXT,
    "tube_count" INTEGER DEFAULT 1,
    "tube_length_mm" DOUBLE PRECISION NOT NULL,
    "parting_length_mm" DOUBLE PRECISION NOT NULL,
    "expected_qty" DOUBLE PRECISION NOT NULL,
    "rounded_qty" INTEGER NOT NULL,
    "end_scrap_mm" DOUBLE PRECISION NOT NULL,
    "pipe_allocation_status" TEXT NOT NULL DEFAULT 'Available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TallyItem_pkey" PRIMARY KEY ("ti_id")
);

-- CreateTable
CREATE TABLE "CustomerOrder" (
    "customer_po_no" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_terms" TEXT NOT NULL,
    "delivery_terms" TEXT NOT NULL,
    "delivery_due_date" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "order_status" TEXT NOT NULL DEFAULT 'Open',
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("customer_po_no")
);

-- CreateTable
CREATE TABLE "CustomerPOLineItem" (
    "cpo_item_id" TEXT NOT NULL,
    "customer_po_no" TEXT NOT NULL,
    "item_seq_no" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "thread" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price_per_unit" DOUBLE PRECISION NOT NULL,
    "line_total" DOUBLE PRECISION NOT NULL,
    "fulfilled_qty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "line_status" TEXT NOT NULL DEFAULT 'Open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPOLineItem_pkey" PRIMARY KEY ("cpo_item_id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "wo_id" TEXT NOT NULL,
    "wo_date" TIMESTAMP(3) NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'PO',
    "po_no" TEXT,
    "size" TEXT,
    "grade" TEXT,
    "thread" TEXT,
    "order_quantity" INTEGER,
    "ti_id" TEXT,
    "target_product_id" TEXT NOT NULL,
    "planned_parts_to_produce" INTEGER NOT NULL,
    "machine_line_no" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "wo_status" TEXT NOT NULL DEFAULT 'Released',
    "customer_po_no" TEXT,
    "cpo_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("wo_id")
);

-- CreateTable
CREATE TABLE "ProductionPosting" (
    "pp_id" TEXT NOT NULL,
    "wo_id" TEXT NOT NULL,
    "process_stage_name" TEXT NOT NULL,
    "operation_seq_no" INTEGER NOT NULL,
    "operator_machine_id" TEXT NOT NULL,
    "input_quantity" INTEGER NOT NULL,
    "accepted_quantity" INTEGER NOT NULL,
    "rejected_quantity" INTEGER NOT NULL,
    "rework_quantity" INTEGER NOT NULL,
    "stage_completion_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPosting_pkey" PRIMARY KEY ("pp_id")
);

-- CreateTable
CREATE TABLE "RejectionPosting" (
    "rp_id" TEXT NOT NULL,
    "pp_id" TEXT NOT NULL,
    "wo_id" TEXT NOT NULL,
    "defect_category" TEXT NOT NULL,
    "defect_quantity" INTEGER NOT NULL,
    "disposition_action" TEXT NOT NULL,
    "inspector_remarks" TEXT,
    "logged_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RejectionPosting_pkey" PRIMARY KEY ("rp_id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PROCUREMENT',
    "roles" TEXT,
    "department" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "force_password_change" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleModulePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "route_path" TEXT NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT true,
    "can_write" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleModulePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_session_token_key" ON "Session"("session_token");

-- CreateIndex
CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");

-- CreateIndex
CREATE INDEX "Session_session_token_idx" ON "Session"("session_token");

-- CreateIndex
CREATE INDEX "Session_expires_at_idx" ON "Session"("expires_at");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "RoleModulePermission_role_idx" ON "RoleModulePermission"("role");

-- CreateIndex
CREATE INDEX "RoleModulePermission_module_key_idx" ON "RoleModulePermission"("module_key");

-- CreateIndex
CREATE UNIQUE INDEX "RoleModulePermission_role_module_key_key" ON "RoleModulePermission"("role", "module_key");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POItem" ADD CONSTRAINT "POItem_po_no_fkey" FOREIGN KEY ("po_no") REFERENCES "PurchaseOrder"("po_no") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POItem" ADD CONSTRAINT "POItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_po_no_fkey" FOREIGN KEY ("po_no") REFERENCES "PurchaseOrder"("po_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "GRN"("grn_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "POItem"("po_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallySheet" ADD CONSTRAINT "TallySheet_grn_item_id_fkey" FOREIGN KEY ("grn_item_id") REFERENCES "GRNItem"("grn_item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallyItem" ADD CONSTRAINT "TallyItem_ts_id_fkey" FOREIGN KEY ("ts_id") REFERENCES "TallySheet"("ts_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPOLineItem" ADD CONSTRAINT "CustomerPOLineItem_customer_po_no_fkey" FOREIGN KEY ("customer_po_no") REFERENCES "CustomerOrder"("customer_po_no") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_ti_id_fkey" FOREIGN KEY ("ti_id") REFERENCES "TallyItem"("ti_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "Product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_po_no_fkey" FOREIGN KEY ("po_no") REFERENCES "PurchaseOrder"("po_no") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customer_po_no_fkey" FOREIGN KEY ("customer_po_no") REFERENCES "CustomerOrder"("customer_po_no") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_cpo_item_id_fkey" FOREIGN KEY ("cpo_item_id") REFERENCES "CustomerPOLineItem"("cpo_item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPosting" ADD CONSTRAINT "ProductionPosting_wo_id_fkey" FOREIGN KEY ("wo_id") REFERENCES "WorkOrder"("wo_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RejectionPosting" ADD CONSTRAINT "RejectionPosting_pp_id_fkey" FOREIGN KEY ("pp_id") REFERENCES "ProductionPosting"("pp_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RejectionPosting" ADD CONSTRAINT "RejectionPosting_wo_id_fkey" FOREIGN KEY ("wo_id") REFERENCES "WorkOrder"("wo_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

