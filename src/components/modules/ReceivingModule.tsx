'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Scale, 
  FileSpreadsheet, 
  Plus, 
  Scissors, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  PackageCheck,
  X, 
  ChevronDown, 
  ChevronRight, 
  Trash2,
  Barcode,
  Sparkles,
  Info,
  Edit
} from 'lucide-react';
import { calculateCuttingYield, calculateWeighbridge, validatePoGrnWeightLimit, formatDate } from '@/lib/calculations';
import { COUPLING_LENGTH_SPECS, findMatchingCouplingLength } from '@/lib/couplingStandards';
import { exportToCsv } from '@/lib/export';
import TagPrintModal from '../TagPrintModal';
import MtcViewerModal from '../MtcViewerModal';

export interface GrnLineItemEntry {
  grn_item_id?: string;
  po_item_id?: string;
  product_id?: string;
  size: string;
  grade: string;
  thread: string;
  invoice_quantity?: string | number;
  received_quantity?: string | number;
  invoice_quantity_mt: string | number;
  actual_quantity_mt: string | number;
  rejected_damaged_qty?: string | number;
  item_inspection_status?: 'Pending QA' | 'Accepted' | 'Rejected';
}

export default function ReceivingModule() {
  const [grns, setGrns] = useState<any[]>([]);
  const [tallySheets, setTallySheets] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'grn' | 'tally'>('grn');
  const [expandedGrn, setExpandedGrn] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isEditGrnMode, setIsEditGrnMode] = useState(false);
  const [isTallyModalOpen, setIsTallyModalOpen] = useState(false);
  const [isEditTallyMode, setIsEditTallyMode] = useState(false);
  const [isCustomPartingLength, setIsCustomPartingLength] = useState(false);
  const [activePrintPipe, setActivePrintPipe] = useState<any | null>(null);
  const [activeMtcSheet, setActiveMtcSheet] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // GRN Form State
  const [grnForm, setGrnForm] = useState<{
    grn_id: string;
    grn_date: string;
    po_no: string;
    invoice_no: string;
    invoice_date: string;
    vehicle_transporter_no: string;
    invoice_weight_mt: string | number;
    actual_weighbridge_weight_mt: string | number;
    total_tubes_received_actual: string | number;
    items: GrnLineItemEntry[];
  }>({
    grn_id: '',
    grn_date: new Date().toISOString().split('T')[0],
    po_no: '',
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    vehicle_transporter_no: '',
    invoice_weight_mt: '',
    actual_weighbridge_weight_mt: '',
    total_tubes_received_actual: '',
    items: [],
  });

  // Tally Sheet Form State with Lot-by-Lot Log (Starts with 1 lot row)
  const [tallyForm, setTallyForm] = useState<{
    ts_id: string;
    grn_item_id: string;
    lot_no: string;
    heat_no: string;
    mill_test_certificate_no: string;
    tally_sheet_date: string;
    inspector_name: string;
    bundle_count: number;
    defaultPartingLength: number;
    lots: {
      ti_id: string;
      tube_sr_no: number;
      heat_no: string;
      lot_no: string;
      mill_test_certificate_no: string;
      tube_count: number;
      tube_length_mm: number;
      parting_length_mm: number;
    }[];
  }>({
    ts_id: '',
    grn_item_id: '',
    lot_no: 'LOT-2026-B1',
    heat_no: 'HT-99142',
    mill_test_certificate_no: 'MTC-TEN-99142-REV1',
    tally_sheet_date: new Date().toISOString().split('T')[0],
    inspector_name: 'Marcus Vance (Level III NDT)',
    bundle_count: 1,
    defaultPartingLength: 135,
    lots: [
      {
        ti_id: 'LOT-HT99142-01',
        tube_sr_no: 1,
        heat_no: 'HT-99142',
        lot_no: 'LOT-2026-B1',
        mill_test_certificate_no: 'MTC-TEN-99142-REV1',
        tube_count: 10,
        tube_length_mm: 121500,
        parting_length_mm: 135,
      },
    ],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [grnRes, tallyRes, poRes] = await Promise.all([
        fetch('/api/grn'),
        fetch('/api/tally'),
        fetch('/api/purchase-orders'),
      ]);
      const [grnData, tallyData, poData] = await Promise.all([
        grnRes.json(),
        tallyRes.json(),
        poRes.json(),
      ]);
      if (Array.isArray(grnData)) {
        setGrns(grnData);
        // Set default grn_item_id and matching coupling length if available
        if (grnData.length > 0 && grnData[0].grn_items?.length > 0) {
          const firstItem = grnData[0].grn_items[0];
          const matched =
            findMatchingCouplingLength(
              firstItem?.product?.size_od || firstItem?.product?.product_description,
              firstItem?.product?.thread_type
            ) || 135;
          setTallyForm((prev) => ({
            ...prev,
            grn_item_id: firstItem.grn_item_id,
            defaultPartingLength: matched,
            lots: prev.lots.map((l) => ({ ...l, parting_length_mm: matched })),
          }));
        }
      }
      if (Array.isArray(tallyData)) setTallySheets(tallyData);
      if (Array.isArray(poData)) {
        setPurchaseOrders(poData);
        if (poData.length > 0 && !grnForm.po_no) {
          setGrnForm((prev) => ({
            ...prev,
            po_no: poData[0].po_no,
            items: (poData[0].po_items && poData[0].po_items.length > 0)
              ? poData[0].po_items.map((poi: any) => ({
                  po_item_id: poi.po_item_id,
                  product_id: poi.product_id,
                  size: poi.product?.size_od ? `${poi.product.size_od}mm OD` : '177.8mm OD',
                  grade: poi.product?.grade || 'L80',
                  thread: poi.product?.thread_type || 'BTC',
                  invoice_quantity: '',
                }))
              : [
                  {
                    po_item_id: '',
                    product_id: '',
                    size: '177.8mm OD',
                    grade: 'L80',
                    thread: 'BTC',
                    invoice_quantity: '',
                  },
                ],
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper: Auto-generate next sequential unique Tally Sheet ID
  const getNextTallySheetId = (existingSheets: any[]) => {
    const year = new Date().getFullYear();
    const nums = existingSheets
      .map((ts) => {
        const m = String(ts.ts_id || '').match(/TS-\d{4}-(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `TS-${year}-${String(max + 1).padStart(3, '0')}`;
  };

  // Helper: Auto-generate next sequential unique Lot Tag / Barcode for a given heat & lot
  const getNextLotTag = (
    heatNo: string,
    lotNo: string,
    existingLotsInForm: { ti_id: string }[] = [],
    existingSheets: any[] = []
  ) => {
    const cleanHeat = (heatNo || 'HT').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanLot = (lotNo || 'LOT').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const basePrefix = cleanLot ? `LOT-${cleanHeat}-${cleanLot}` : `LOT-${cleanHeat}`;

    const allUsedTags = new Set<string>();
    existingSheets.forEach((ts) => {
      (ts.tally_items || []).forEach((item: any) => {
        if (item.ti_id) allUsedTags.add(String(item.ti_id).trim().toUpperCase());
      });
    });
    existingLotsInForm.forEach((l) => {
      if (l.ti_id) allUsedTags.add(String(l.ti_id).trim().toUpperCase());
    });

    if (!allUsedTags.has(basePrefix)) {
      return basePrefix;
    }

    let seq = 1;
    let candidate = `${basePrefix}-${String(seq).padStart(2, '0')}`;
    while (allUsedTags.has(candidate)) {
      seq++;
      candidate = `${basePrefix}-${String(seq).padStart(2, '0')}`;
    }
    return candidate;
  };

  // Handle default heat number change (with option to propagate to initial empty rows)
  const handleDefaultHeatChange = (newHeat: string) => {
    setTallyForm((prev) => ({
      ...prev,
      heat_no: newHeat,
      lots: prev.lots.map((lot, idx) => {
        if (!lot.heat_no || lot.heat_no === prev.heat_no) {
          const newTag = getNextLotTag(newHeat, lot.lot_no, prev.lots.filter((_, i) => i !== idx), tallySheets);
          return { ...lot, heat_no: newHeat, ti_id: newTag };
        }
        return lot;
      }),
    }));
  };

  // Handle lot row updates
  const handleLotChange = (index: number, field: string, value: any) => {
    setTallyForm((prev) => {
      const updated = [...prev.lots];
      const cur = { ...updated[index], [field]: value };

      if (field === 'heat_no' || field === 'lot_no') {
        const otherLots = updated.filter((_, i) => i !== index);
        cur.ti_id = getNextLotTag(cur.heat_no, cur.lot_no, otherLots, tallySheets);
      }

      updated[index] = cur;
      return { ...prev, lots: updated };
    });
  };

  const handleAddLot = () => {
    const defaultParting = tallyForm.defaultPartingLength || 135;
    const nextSr = tallyForm.lots.length + 1;
    const heat = tallyForm.heat_no || 'HT-99142';
    const lotSuggest = `${tallyForm.lot_no || 'LOT-2026'}-${nextSr}`;
    const nextTag = getNextLotTag(heat, lotSuggest, tallyForm.lots, tallySheets);

    setTallyForm((prev) => ({
      ...prev,
      lots: [
        ...prev.lots,
        {
          ti_id: nextTag,
          tube_sr_no: nextSr,
          heat_no: heat,
          lot_no: lotSuggest,
          mill_test_certificate_no: prev.mill_test_certificate_no,
          tube_count: 10,
          tube_length_mm: 121500, // Total combined length of tubes in lot
          parting_length_mm: defaultParting,
        },
      ],
    }));
  };

  const handleRemoveLot = (index: number) => {
    if (tallyForm.lots.length === 1) return;
    setTallyForm((prev) => ({
      ...prev,
      lots: prev.lots.filter((_, i) => i !== index),
    }));
  };

  // Add / Remove / Update GRN Line Item Handlers
  const handleAddGrnLineItem = () => {
    setGrnForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          po_item_id: '',
          product_id: '',
          size: '7" (177.8mm)',
          grade: 'L80',
          thread: 'BTC',
          invoice_quantity_mt: '',
          actual_quantity_mt: '',
        },
      ],
    }));
  };

  const handleRemoveGrnLineItem = (index: number) => {
    if (grnForm.items.length <= 1) return;
    setGrnForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateGrnLineItem = (index: number, field: keyof GrnLineItemEntry, value: any) => {
    setGrnForm((prev) => {
      const updated = [...prev.items];
      if (field === 'size' || field === 'grade' || field === 'thread') {
        updated[index] = { ...updated[index], [field]: value, product_id: '' };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return {
        ...prev,
        items: updated,
      };
    });
  };

  // Open GRN Modal with Clean Blank State
  const handleOpenCreateGRN = () => {
    setIsEditGrnMode(false);
    setFormError(null);
    const defaultPo = purchaseOrders[0];
    setGrnForm({
      grn_id: `GRN-${new Date().getFullYear()}-${String(grns.length + 1).padStart(3, '0')}`,
      grn_date: new Date().toISOString().split('T')[0],
      po_no: defaultPo ? defaultPo.po_no : '',
      invoice_no: '',
      invoice_date: new Date().toISOString().split('T')[0],
      vehicle_transporter_no: '',
      invoice_weight_mt: '',
      actual_weighbridge_weight_mt: '',
      total_tubes_received_actual: '',
      items: (defaultPo?.po_items && defaultPo.po_items.length > 0)
        ? defaultPo.po_items.map((poi: any) => ({
            po_item_id: poi.po_item_id,
            product_id: poi.product_id,
            size: poi.product?.size_od ? `${poi.product.size_od}mm OD` : '177.8mm OD',
            grade: poi.product?.grade || 'L80',
            thread: (poi.product?.thread_type === 'Premium' ? 'EUE' : poi.product?.thread_type) || 'BTC',
            invoice_quantity_mt: '', // Blank: requires explicit user entry
            actual_quantity_mt: '',  // Blank: requires explicit user entry
          }))
        : [
            {
              po_item_id: '',
              product_id: '',
              size: '177.8mm OD',
              grade: 'L80',
              thread: 'BTC',
              invoice_quantity_mt: '',
              actual_quantity_mt: '',
            },
          ],
    });
    setIsGrnModalOpen(true);
  };

  // Open GRN Modal in Edit Mode (Populate Header & Line Items)
  const handleOpenEditGRN = (grn: any) => {
    setIsEditGrnMode(true);
    setFormError(null);
    setGrnForm({
      grn_id: grn.grn_id,
      grn_date: grn.grn_date ? new Date(grn.grn_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      po_no: grn.po_no || '',
      invoice_no: grn.invoice_no || '',
      invoice_date: grn.invoice_date ? new Date(grn.invoice_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      vehicle_transporter_no: grn.vehicle_transporter_no || '',
      invoice_weight_mt: grn.invoice_weight_mt !== undefined && grn.invoice_weight_mt !== null ? String(grn.invoice_weight_mt) : '',
      actual_weighbridge_weight_mt: grn.actual_weighbridge_weight_mt !== undefined && grn.actual_weighbridge_weight_mt !== null ? String(grn.actual_weighbridge_weight_mt) : '',
      total_tubes_received_actual: '',
      items: grn.grn_items && grn.grn_items.length > 0
        ? grn.grn_items.map((gi: any) => ({
            grn_item_id: gi.grn_item_id,
            po_item_id: gi.po_item_id || '',
            product_id: gi.product_id || '',
            size: gi.size || (gi.product?.size_od ? `${gi.product.size_od}mm OD` : '177.8mm OD'),
            grade: gi.grade || gi.product?.grade || 'L80',
            thread: (gi.thread === 'Premium' ? 'EUE' : gi.thread) || (gi.product?.thread_type === 'Premium' ? 'EUE' : gi.product?.thread_type) || 'BTC',
            invoice_quantity_mt: gi.invoice_quantity_mt !== undefined && gi.invoice_quantity_mt !== null ? String(gi.invoice_quantity_mt) : (gi.invoice_quantity !== undefined ? String(gi.invoice_quantity) : ''),
            actual_quantity_mt: gi.actual_quantity_mt !== undefined && gi.actual_quantity_mt !== null ? String(gi.actual_quantity_mt) : (gi.received_quantity !== undefined ? String(gi.received_quantity) : ''),
          }))
        : [
            {
              po_item_id: '',
              product_id: '',
              size: '177.8mm OD',
              grade: 'L80',
              thread: 'BTC',
              invoice_quantity_mt: '',
              actual_quantity_mt: '',
            },
          ],
    });
    setIsGrnModalOpen(true);
  };

  // Create GRN
  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!grnForm.invoice_no.trim()) {
      setFormError('Invoice Number is required.');
      return;
    }
    if (!grnForm.vehicle_transporter_no.trim()) {
      setFormError('Transporter / Vehicle Number is required.');
      return;
    }
    if (grnForm.items.length === 0) {
      setFormError('Please add at least one line item for this GRN.');
      return;
    }

    // Explicit User Entry Validation: Size, Grade, Thread, Qty as per invoice (MT), Actual Qty (MT)
    for (let idx = 0; idx < grnForm.items.length; idx++) {
      const item = grnForm.items[idx];
      if (!item.size || !String(item.size).trim()) {
        setFormError(`User Entry Required: Please enter Size for line item #${idx + 1}.`);
        return;
      }
      if (!item.grade || !String(item.grade).trim()) {
        setFormError(`User Entry Required: Please enter Grade for line item #${idx + 1}.`);
        return;
      }
      if (!item.thread || !String(item.thread).trim()) {
        setFormError(`User Entry Required: Please enter Thread for line item #${idx + 1}.`);
        return;
      }
      if (
        item.invoice_quantity_mt === '' ||
        isNaN(Number(item.invoice_quantity_mt)) ||
        Number(item.invoice_quantity_mt) <= 0
      ) {
        setFormError(
          `User Entry Required: Please enter a valid positive "Qty as per invoice (MT)" for line item #${idx + 1}.`
        );
        return;
      }
      if (
        item.actual_quantity_mt === '' ||
        isNaN(Number(item.actual_quantity_mt)) ||
        Number(item.actual_quantity_mt) < 0
      ) {
        setFormError(
          `User Entry Required: Please enter a valid non-negative "Actual Qty (MT)" for line item #${idx + 1}.`
        );
        return;
      }
    }

    // Auto-calculate "Invoice Weight (MT)" as sum of all "Qty as per invoice (MT)"
    // and "Actual Weighbridge (MT)" as sum of all "Actual Qty (MT)"
    const autoCalculatedInvoiceWeightMt = Number(
      grnForm.items.reduce((sum, item) => {
        const inv = parseFloat(String(item.invoice_quantity_mt));
        return sum + (!isNaN(inv) && inv > 0 ? inv : 0);
      }, 0).toFixed(3)
    );
    const autoCalculatedActualWeighbridgeMt = Number(
      grnForm.items.reduce((sum, item) => {
        const act = parseFloat(String(item.actual_quantity_mt));
        return sum + (!isNaN(act) && act > 0 ? act : 0);
      }, 0).toFixed(3)
    );

    const selectedPo = purchaseOrders.find((p) => p.po_no === grnForm.po_no);
    const poTotalOrderedMt = selectedPo?.po_items?.reduce(
      (sum: number, item: any) => sum + (Number(item.ordered_qty_mt) || 0),
      0
    ) || 0;

    const otherGrnsForPo = grns.filter((g) => g.po_no === grnForm.po_no && g.grn_id !== grnForm.grn_id);
    const existingGrnInvoiceMtSum = otherGrnsForPo.reduce((sum: number, g: any) => {
      return sum + (Number(g.invoice_weight_mt) || 0);
    }, 0);

    const newCumulativeInvoiceMt = existingGrnInvoiceMtSum + autoCalculatedInvoiceWeightMt;
    const remainingAllowableInvoiceMt = Math.max(0, poTotalOrderedMt - existingGrnInvoiceMtSum);

    if (newCumulativeInvoiceMt > poTotalOrderedMt + 0.0001) {
      setFormError(
        `Validation Error: Sum of all "Qty as per invoice (MT)" (${newCumulativeInvoiceMt.toFixed(3)} MT) associated with PO ${grnForm.po_no} exceeds PO's Total Ordered MT (${poTotalOrderedMt.toFixed(3)} MT). Already received in earlier GRNs: ${existingGrnInvoiceMtSum.toFixed(3)} MT. This GRN items total: ${autoCalculatedInvoiceWeightMt.toFixed(3)} MT. Maximum allowable remaining is ${remainingAllowableInvoiceMt.toFixed(3)} MT.`
      );
      return;
    }

    // Per-item PO Ordered MT check
    for (let idx = 0; idx < grnForm.items.length; idx++) {
      const item = grnForm.items[idx];
      const invMt = parseFloat(String(item.invoice_quantity_mt));
      const matchedPoi = resolvePoiForGrnItem(item, idx, selectedPo);

      if (matchedPoi) {
        const poOrderedMt = Number(matchedPoi.ordered_qty_mt);
        if (invMt > poOrderedMt + 0.0001) {
          setFormError(
            `Validation Error: "Qty as per invoice (MT)" (${invMt.toFixed(3)} MT) cannot exceed PO's Ordered MT (${poOrderedMt.toFixed(3)} MT) for line item #${idx + 1} (${matchedPoi.po_item_id}).`
          );
          return;
        }

        const prevInvoicedMt = otherGrnsForPo.reduce((sum, g) => {
          const mItems = (g.grn_items || []).filter((gi: any) => gi.po_item_id === matchedPoi.po_item_id);
          return sum + mItems.reduce((s: number, gi: any) => s + (Number(gi.invoice_quantity_mt) || 0), 0);
        }, 0);

        const otherRowsInFormMt = grnForm.items
          .filter((r, i) => {
            if (i === idx) return false;
            const rPoi = resolvePoiForGrnItem(r, i, selectedPo);
            return rPoi?.po_item_id === matchedPoi.po_item_id;
          })
          .reduce((sum, r) => {
            const v = Number(r.invoice_quantity_mt);
            return sum + (!isNaN(v) && v > 0 ? v : 0);
          }, 0);

        const remainingPoiMt = Math.max(0, poOrderedMt - prevInvoicedMt - otherRowsInFormMt);
        if (invMt > remainingPoiMt + 0.0001) {
          setFormError(
            `Validation Error: "Qty as per invoice (MT)" (${invMt.toFixed(3)} MT) exceeds remaining allowable MT (${remainingPoiMt.toFixed(3)} MT) for PO Item ${matchedPoi.po_item_id}.`
          );
          return;
        }
      }
    }

    const currentItems = grnForm.items.map((item) => {
      const matchedPoi = selectedPo?.po_items?.find(
        (poi: any) => poi.po_item_id === item.po_item_id
      ) || selectedPo?.po_items?.[0];
      const invMt = parseFloat(String(item.invoice_quantity_mt)) || 0;
      const actMt = parseFloat(String(item.actual_quantity_mt)) || 0;

      return {
        grn_item_id: item.grn_item_id || undefined,
        po_item_id: item.po_item_id || matchedPoi?.po_item_id || '',
        product_id: item.product_id || '',
        size: item.size,
        grade: item.grade,
        thread: item.thread,
        invoice_quantity: invMt,
        received_quantity: actMt,
        invoice_quantity_mt: invMt,
        actual_quantity_mt: actMt,
        rejected_damaged_qty: 0,
        item_inspection_status: 'Pending QA' as const,
      };
    });

    const weightGate = validatePoGrnWeightLimit(poTotalOrderedMt, existingGrnInvoiceMtSum, autoCalculatedInvoiceWeightMt);
    if (weightGate.isExceeded) {
      setFormError(
        `Validation Error: Cumulative GRN Invoice Weight (${weightGate.newCumulativeInvoiceMt.toFixed(3)} MT) exceeds PO ${grnForm.po_no}'s Total Ordered Weight (${poTotalOrderedMt.toFixed(3)} MT). Already received in earlier GRNs: ${existingGrnInvoiceMtSum.toFixed(3)} MT. Maximum allowable remaining Invoice Weight is ${weightGate.remainingAllowableMt.toFixed(3)} MT.`
      );
      return;
    }

    const payload = {
      ...grnForm,
      invoice_weight_mt: autoCalculatedInvoiceWeightMt,
      actual_weighbridge_weight_mt: autoCalculatedActualWeighbridgeMt,
      total_tubes_received_actual: 0,
      items: currentItems,
    };

    try {
      const res = await fetch('/api/grn', {
        method: isEditGrnMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditGrnMode ? 'update' : 'create'} GRN`);

      setIsGrnModalOpen(false);
      setIsEditGrnMode(false);
      // Clean form after saving
      setGrnForm({
        grn_id: '',
        grn_date: new Date().toISOString().split('T')[0],
        po_no: purchaseOrders[0]?.po_no || '',
        invoice_no: '',
        invoice_date: new Date().toISOString().split('T')[0],
        vehicle_transporter_no: '',
        invoice_weight_mt: '',
        actual_weighbridge_weight_mt: '',
        total_tubes_received_actual: '',
        items: (purchaseOrders[0]?.po_items && purchaseOrders[0].po_items.length > 0)
          ? purchaseOrders[0].po_items.map((poi: any) => ({
              po_item_id: poi.po_item_id,
              product_id: poi.product_id,
              size: poi.product?.size_od ? `${poi.product.size_od}mm OD` : '177.8mm OD',
              grade: poi.product?.grade || 'L80',
              thread: (poi.product?.thread_type === 'Premium' ? 'EUE' : poi.product?.thread_type) || 'BTC',
              invoice_quantity_mt: '',
              actual_quantity_mt: '',
            }))
          : [
              {
                po_item_id: '',
                product_id: '',
                size: '177.8mm OD',
                grade: 'L80',
                thread: 'BTC',
                invoice_quantity_mt: '',
                actual_quantity_mt: '',
              },
            ],
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Tally Handlers
  const handleOpenCreateTally = (defaultGrnItemId?: string) => {
    setIsEditTallyMode(false);
    setFormError(null);
    const chosenGrnItemId = defaultGrnItemId || grns[0]?.grn_items?.[0]?.grn_item_id || '';
    const selectedGrnItem = grns.flatMap((g) => g.grn_items || []).find((i) => i.grn_item_id === chosenGrnItemId);
    const matchedLength =
      findMatchingCouplingLength(
        selectedGrnItem?.product?.size_od || selectedGrnItem?.product?.product_description,
        selectedGrnItem?.product?.thread_type
      ) || 135;

    setIsCustomPartingLength(false);
    const nextTsId = getNextTallySheetId(tallySheets);
    const defaultHeat = 'HT-99142';
    const defaultLot = 'LOT-2026-B1';
    const initialLotTag = getNextLotTag(defaultHeat, defaultLot, [], tallySheets);

    setTallyForm({
      ts_id: nextTsId,
      grn_item_id: chosenGrnItemId,
      lot_no: defaultLot,
      heat_no: defaultHeat,
      mill_test_certificate_no: 'MTC-TEN-99142-REV1',
      tally_sheet_date: new Date().toISOString().split('T')[0],
      inspector_name: 'Marcus Vance (Level III NDT)',
      bundle_count: 1,
      defaultPartingLength: matchedLength,
      lots: [
        {
          ti_id: initialLotTag,
          tube_sr_no: 1,
          heat_no: defaultHeat,
          lot_no: defaultLot,
          mill_test_certificate_no: 'MTC-TEN-99142-REV1',
          tube_count: 10,
          tube_length_mm: 121500, // Total length of tubes in lot
          parting_length_mm: matchedLength,
        },
      ],
    });
    setIsTallyModalOpen(true);
  };

  const handleOpenEditTally = (ts: any) => {
    setIsEditTallyMode(true);
    setFormError(null);
    const defaultParting = ts.tally_items?.[0]?.parting_length_mm || 135;
    const isStandard = COUPLING_LENGTH_SPECS.some((s) => s.length_mm === defaultParting);
    setIsCustomPartingLength(!isStandard);
    setTallyForm({
      ts_id: ts.ts_id,
      grn_item_id: ts.grn_item_id,
      lot_no: ts.lot_no || 'LOT-2026-B1',
      heat_no: ts.heat_no || 'HT-99142',
      mill_test_certificate_no: ts.mill_test_certificate_no || '',
      tally_sheet_date: ts.tally_sheet_date ? new Date(ts.tally_sheet_date).toISOString().split('T')[0] : '',
      inspector_name: ts.inspector_name,
      bundle_count: ts.bundle_count || 1,
      defaultPartingLength: defaultParting,
      lots: ts.tally_items && ts.tally_items.length > 0
        ? ts.tally_items.map((ti: any, idx: number) => ({
            ti_id: ti.ti_id,
            tube_sr_no: ti.tube_sr_no || idx + 1,
            heat_no: ti.heat_no || ts.heat_no || '',
            lot_no: ti.lot_no || ts.lot_no || '',
            mill_test_certificate_no: ti.mill_test_certificate_no || ts.mill_test_certificate_no || '',
            tube_count: ti.tube_count ?? 1,
            tube_length_mm: ti.tube_length_mm,
            parting_length_mm: ti.parting_length_mm || defaultParting,
          }))
        : [
            {
              ti_id: getNextLotTag(ts.heat_no, ts.lot_no, [], tallySheets),
              tube_sr_no: 1,
              heat_no: ts.heat_no || '',
              lot_no: ts.lot_no || '',
              mill_test_certificate_no: ts.mill_test_certificate_no || '',
              tube_count: 10,
              tube_length_mm: 121500,
              parting_length_mm: defaultParting,
            },
          ],
    });
    setIsTallyModalOpen(true);
  };

  const handleDeleteTally = async (tsId: string) => {
    if (!confirm(`Are you sure you want to delete Tally Sheet ${tsId}? This will remove all associated lot records.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/tally?ts_id=${encodeURIComponent(tsId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete Tally Sheet');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Tally Sheet (Create or Edit)
  const handleSubmitTally = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Validate required fields on each lot
    for (let i = 0; i < tallyForm.lots.length; i++) {
      const lot = tallyForm.lots[i];
      if (!lot.ti_id.trim()) {
        setFormError(`Validation Error: Lot row #${i + 1} has an empty Lot Tag / Barcode.`);
        return;
      }
      if (!lot.heat_no.trim()) {
        setFormError(`Validation Error: Lot row #${i + 1} has an empty Heat Number.`);
        return;
      }
      if (!lot.lot_no.trim()) {
        setFormError(`Validation Error: Lot row #${i + 1} has an empty Lot Number.`);
        return;
      }
      if (!lot.tube_count || lot.tube_count <= 0) {
        setFormError(`Validation Error: Lot row #${i + 1} must have a valid tube count (Qty ≥ 1).`);
        return;
      }
      if (!lot.tube_length_mm || lot.tube_length_mm <= 0) {
        setFormError(`Validation Error: Lot row #${i + 1} has an invalid Total Tube Length (mm). Must be greater than 0.`);
        return;
      }
      if (!lot.parting_length_mm || lot.parting_length_mm <= 0) {
        setFormError(`Validation Error: Lot row #${i + 1} has an invalid Parting Length (mm). Must be greater than 0.`);
        return;
      }
    }

    // 2. Check for duplicate barcodes within the form
    const seenFormTags = new Set<string>();
    for (let i = 0; i < tallyForm.lots.length; i++) {
      const tag = tallyForm.lots[i].ti_id.trim().toUpperCase();
      if (seenFormTags.has(tag)) {
        setFormError(`Duplicate Barcode in Form: "${tallyForm.lots[i].ti_id}" appears more than once in this Tally Sheet. Every lot must have a unique barcode.`);
        return;
      }
      seenFormTags.add(tag);
    }

    // 3. Check for collisions with other Tally Sheets in state
    for (const lot of tallyForm.lots) {
      const tag = lot.ti_id.trim().toUpperCase();
      for (const ts of tallySheets) {
        if (isEditTallyMode && ts.ts_id === tallyForm.ts_id) continue;
        const exists = (ts.tally_items || []).some((ti: any) => ti.ti_id?.trim().toUpperCase() === tag);
        if (exists) {
          setFormError(
            `Duplicate Barcode Error: Lot Tag / Barcode "${lot.ti_id}" is already used in Tally Sheet "${ts.ts_id}". Every lot must have a unique Lot Tag Barcode.`
          );
          return;
        }
      }
    }

    try {
      const payload = {
        ts_id: tallyForm.ts_id,
        grn_item_id: tallyForm.grn_item_id,
        lot_no: tallyForm.lots[0]?.lot_no || tallyForm.lot_no,
        heat_no: tallyForm.lots[0]?.heat_no || tallyForm.heat_no,
        mill_test_certificate_no: tallyForm.lots[0]?.mill_test_certificate_no || tallyForm.mill_test_certificate_no,
        tally_sheet_date: tallyForm.tally_sheet_date,
        inspector_name: tallyForm.inspector_name,
        bundle_count: tallyForm.bundle_count,
        tally_items: tallyForm.lots.map((lot, idx) => ({
          ti_id: lot.ti_id.trim(),
          tube_sr_no: lot.tube_sr_no || idx + 1,
          heat_no: lot.heat_no.trim(),
          lot_no: lot.lot_no.trim(),
          mill_test_certificate_no: lot.mill_test_certificate_no?.trim() || null,
          tube_count: Number(lot.tube_count) || 1,
          tube_length_mm: Number(lot.tube_length_mm),
          parting_length_mm: Number(lot.parting_length_mm),
        })),
      };

      const res = await fetch('/api/tally', {
        method: isEditTallyMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditTallyMode ? 'update' : 'create'} Tally Sheet`);

      setIsTallyModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Delete Handlers
  const handleDeleteGRN = async (grnId: string) => {
    if (!window.confirm(`Are you sure you want to delete GRN ${grnId}?\nThis will permanently remove the GRN and all associated line items.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/grn?grn_id=${encodeURIComponent(grnId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete GRN');
      alert(`GRN ${grnId} was successfully deleted.`);
      if (expandedGrn === grnId) setExpandedGrn(null);
      fetchData();
    } catch (err: any) {
      alert(`Error deleting GRN: ${err.message}`);
    }
  };

  const handleDeleteGrnLineItem = async (grnItemId: string, grnId: string, itemCount: number) => {
    if (itemCount <= 1) {
      alert(`Cannot delete line item ${grnItemId}: It is the only line item for GRN ${grnId}.\nA GRN must have at least one line item. You can delete the entire GRN instead, or add another line item first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete GRN line item ${grnItemId}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/grn?grn_item_id=${encodeURIComponent(grnItemId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete GRN line item');
      alert(`GRN line item ${grnItemId} was successfully deleted.`);
      fetchData();
    } catch (err: any) {
      alert(`Error deleting GRN line item: ${err.message}`);
    }
  };

  // Live auto-calculated weighbridge preview from Line Items
  const autoCalculatedInvoiceWeightMt = Number(
    grnForm.items.reduce((sum, item) => {
      const val = parseFloat(String(item.invoice_quantity_mt));
      return sum + (!isNaN(val) && val > 0 ? val : 0);
    }, 0).toFixed(3)
  );
  const autoCalculatedActualWeighbridgeMt = Number(
    grnForm.items.reduce((sum, item) => {
      const val = parseFloat(String(item.actual_quantity_mt));
      return sum + (!isNaN(val) && val > 0 ? val : 0);
    }, 0).toFixed(3)
  );

  const invWt = autoCalculatedInvoiceWeightMt;
  const actWt = autoCalculatedActualWeighbridgeMt;
  const hasWeighbridgeValues = invWt > 0 || actWt > 0;
  const weighbridgeCalc = calculateWeighbridge(invWt, actWt);

  // Selected PO Weight Reconciliation Gate
  const activeSelectedPo = purchaseOrders.find((p) => p.po_no === grnForm.po_no);
  const poTotalOrderedMt = activeSelectedPo?.po_items?.reduce(
    (sum: number, item: any) => sum + (Number(item.ordered_qty_mt) || 0),
    0
  ) || 0;
  const otherGrnsForPo = grns.filter((g) => g.po_no === grnForm.po_no && g.grn_id !== grnForm.grn_id);
  const existingGrnInvoiceMt = otherGrnsForPo.reduce(
    (sum: number, g: any) => sum + (Number(g.invoice_weight_mt) || 0),
    0
  );

  const poWeightGate = validatePoGrnWeightLimit(
    poTotalOrderedMt,
    existingGrnInvoiceMt,
    invWt
  );
  const isInvoiceMtExceeded = poWeightGate.isExceeded && invWt > 0;

  // Selected PO Cumulative MT checks
  const existingGrnInvoiceMtSum = existingGrnInvoiceMt;
  const currentGrnItemsMtTotal = invWt;
  const remainingAllowableInvoiceMt = Math.max(0, poTotalOrderedMt - existingGrnInvoiceMtSum);
  const isTotalInvoiceMtExceeded = currentGrnItemsMtTotal + existingGrnInvoiceMtSum > poTotalOrderedMt + 0.0001;

  // Helper to resolve PO Item for any GRN line entry
  const resolvePoiForGrnItem = (entry: GrnLineItemEntry, index: number, po: any) => {
    if (!po?.po_items || po.po_items.length === 0) return null;
    return (
      po.po_items.find((poi: any) => poi.po_item_id && poi.po_item_id === entry.po_item_id) ||
      po.po_items[index] ||
      po.po_items[0]
    );
  };

  // Selected PO Line Items Individual Gate Check
  const hasAnyItemQtyExceeded = grnForm.items.some((item, idx) => {
    if (item.invoice_quantity_mt === '' || isNaN(Number(item.invoice_quantity_mt))) return false;
    const itemInvMt = Number(item.invoice_quantity_mt);
    const matchedPoi = resolvePoiForGrnItem(item, idx, activeSelectedPo);
    if (!matchedPoi) return false;
    const poOrderedMt = Number(matchedPoi.ordered_qty_mt) || 0;
    if (itemInvMt > poOrderedMt + 0.0001) return true;

    // Remaining considering what previous GRNs took for this PO Item
    const prevInvoicedMt = otherGrnsForPo.reduce((sum, g) => {
      const mItems = (g.grn_items || []).filter((gi: any) => gi.po_item_id === matchedPoi.po_item_id);
      return sum + mItems.reduce((s: number, gi: any) => s + (Number(gi.invoice_quantity_mt) || 0), 0);
    }, 0);

    // Remaining considering what OTHER rows in current form took for the SAME PO item
    const otherRowsForSamePoiMt = grnForm.items
      .filter((r, i) => {
        if (i === idx) return false;
        const rPoi = resolvePoiForGrnItem(r, i, activeSelectedPo);
        return rPoi?.po_item_id === matchedPoi.po_item_id;
      })
      .reduce((sum, r) => {
        const v = Number(r.invoice_quantity_mt);
        return sum + (!isNaN(v) && v > 0 ? v : 0);
      }, 0);

    const rowRemaining = Math.max(0, poOrderedMt - prevInvoicedMt - otherRowsForSamePoiMt);
    return itemInvMt > rowRemaining + 0.0001;
  });

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Receiving, Weighbridge & Lot Tally</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gate weighbridge weight difference validation and lot-by-lot dimensional inwarding with instant cutting yield math.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveSubTab('grn')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-2 transition-all ${
                activeSubTab === 'grn' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Goods Receipt (GRN)</span>
            </button>
            <button
              onClick={() => setActiveSubTab('tally')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-2 transition-all ${
                activeSubTab === 'tally' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Lot Tally Sheets</span>
            </button>
          </div>

          {activeSubTab === 'grn' ? (
            <button
              onClick={handleOpenCreateGRN}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Log GRN Entry</span>
            </button>
          ) : (
            <button
              onClick={() => handleOpenCreateTally()}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all"
            >
              <Scissors className="w-4 h-4" />
              <span>New Lot Tally Log</span>
            </button>
          )}
        </div>
      </div>

      {/* SubTab 1: GRN List */}
      {activeSubTab === 'grn' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-3 text-center"></th>
                    <th className="px-4 py-3">GRN ID</th>
                    <th className="px-4 py-3">PO & Supplier</th>
                    <th className="px-4 py-3">Invoice & Transporter</th>
                    <th className="px-4 py-3">Invoice MT</th>
                    <th className="px-4 py-3">Weighbridge MT</th>
                    <th className="px-4 py-3">Weight Delta</th>
                    <th className="px-4 py-3">Tally Tubes</th>
                    <th className="px-4 py-3">Tally Match</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {grns.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500 font-sans">
                        {isLoading ? 'Loading GRNs...' : 'No goods receipt notes recorded.'}
                      </td>
                    </tr>
                  ) : (
                    grns.map((g) => {
                      const isMatched = g.tally_match_status === 'Matched';
                      const isExpanded = expandedGrn === g.grn_id;
                      return (
                        <React.Fragment key={g.grn_id}>
                          <tr
                            onClick={() => setExpandedGrn(isExpanded ? null : g.grn_id)}
                            className={`hover:bg-slate-850/50 transition-colors cursor-pointer select-none ${
                              isExpanded ? 'bg-slate-850/40' : ''
                            }`}
                          >
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                className="text-slate-400 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedGrn(isExpanded ? null : g.grn_id);
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-blue-400">{g.grn_id}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                Date: {formatDate(g.grn_date)} • {g.grn_items?.length || 0} item{g.grn_items?.length === 1 ? '' : 's'}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-sans">
                              <div className="text-slate-200 font-medium">{g.po_no}</div>
                              <div className="text-[11px] text-slate-400">
                                {g.purchase_order?.supplier?.supplier_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-sans">
                              <div className="text-slate-300 font-medium">{g.invoice_no}</div>
                              <div className="text-[11px] text-slate-400 font-sans">
                                Date: {formatDate(g.invoice_date)} <span className="text-slate-500 font-mono">• {g.vehicle_transporter_no}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-slate-200 font-bold">{g.invoice_weight_mt} MT</div>
                              {(() => {
                                const matchedPo = purchaseOrders.find((p) => p.po_no === g.po_no);
                                const poOrderedMt = matchedPo?.po_items?.reduce(
                                  (sum: number, item: any) => sum + (Number(item.ordered_qty_mt) || 0),
                                  0
                                ) || 0;
                                const poCumulativeGrnMt = grns
                                  .filter((item) => item.po_no === g.po_no)
                                  .reduce((sum: number, item: any) => sum + (Number(item.invoice_weight_mt) || 0), 0);
                                return poOrderedMt > 0 ? (
                                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                                    PO Sum: {poCumulativeGrnMt.toFixed(2)} / {poOrderedMt.toFixed(2)} MT
                                  </div>
                                ) : null;
                              })()}
                            </td>
                            <td className="px-4 py-3 text-slate-300 font-bold">{g.actual_weighbridge_weight_mt} MT</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  g.weight_difference_mt < 0
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : g.weight_difference_mt > 0
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {g.weight_difference_mt > 0 ? '+' : ''}
                                {g.weight_difference_mt} MT
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-200">{g.total_tubes_tally}</td>
                            <td className="px-4 py-3 font-sans">
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  isMatched
                                    ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                                    : 'bg-amber-950 border border-amber-800 text-amber-300'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isMatched ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                ></span>
                                <span>{g.tally_match_status}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-sans">
                              <div className="flex items-center justify-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditGRN(g)}
                                  className="px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-700/70 text-blue-300 text-[11px] font-medium inline-flex items-center space-x-1 transition-colors"
                                  title="Edit GRN Record & Line Items"
                                >
                                  <Edit className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGRN(g.grn_id)}
                                  className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700/70 text-rose-300 text-[11px] font-medium inline-flex items-center space-x-1 transition-colors"
                                  title="Delete GRN Entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded GRN Items (Child Line Items) */}
                          {isExpanded && (
                            <tr className="bg-slate-950/80 border-b border-slate-800">
                              <td colSpan={11} className="p-4 pl-10 sm:pl-14">
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-inner">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                                    <div className="flex items-center space-x-2">
                                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                      <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                                        GRN Line Items (GRN_Item) — {g.grn_items?.length || 0} Item{g.grn_items?.length === 1 ? '' : 's'} for {g.grn_id}
                                      </span>
                                      <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                                        • PO: <span className="text-blue-300">{g.po_no}</span>
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2 self-start sm:self-auto">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditGRN(g);
                                        }}
                                        className="px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-700 text-blue-200 text-[11px] font-medium flex items-center space-x-1.5 transition-colors"
                                      >
                                        <Edit className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Edit GRN & Line Items</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenCreateTally(g.grn_items?.[0]?.grn_item_id);
                                        }}
                                        className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 text-[11px] font-medium flex items-center space-x-1.5 transition-colors"
                                      >
                                        <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>+ Log Pipe Tally for this GRN</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteGRN(g.grn_id);
                                        }}
                                        className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 text-[11px] font-medium flex items-center space-x-1.5 transition-colors"
                                        title="Delete GRN Entry"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Delete GRN</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Sub-table */}
                                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                                        <tr>
                                          <th className="px-3 py-2">GRN Item ID</th>
                                          <th className="px-3 py-2">Size</th>
                                          <th className="px-3 py-2">Grade</th>
                                          <th className="px-3 py-2">Thread</th>
                                          <th className="px-3 py-2">Qty as per invoice (MT)</th>
                                          <th className="px-3 py-2">Actual Qty (MT)</th>
                                          <th className="px-3 py-2">QA Status</th>
                                          <th className="px-3 py-2">Linked Pipe Tally Sheets</th>
                                          <th className="px-3 py-2 text-center">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                        {(!g.grn_items || g.grn_items.length === 0) ? (
                                          <tr>
                                            <td colSpan={9} className="px-3 py-4 text-center text-slate-500 font-sans">
                                              No individual items found for this GRN.
                                            </td>
                                          </tr>
                                        ) : (
                                          g.grn_items.map((item: any) => {
                                            const prd = item.product;
                                            const itemTallies = tallySheets.filter(
                                              (ts) => ts.grn_item_id === item.grn_item_id
                                            );
                                            return (
                                              <tr key={item.grn_item_id} className="hover:bg-slate-850/50">
                                                <td className="px-3 py-2 font-bold text-blue-400 font-mono">
                                                  {item.grn_item_id}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-slate-200 font-bold">
                                                  {prd?.size_od ? `${prd.size_od}mm OD` : '—'}
                                                  {prd?.wall_thickness ? (
                                                    <span className="text-[10px] text-slate-400 font-normal block">
                                                      WT: {prd.wall_thickness}mm ({prd.schedule || 'Sch 80'})
                                                    </span>
                                                  ) : null}
                                                </td>
                                                <td className="px-3 py-2">
                                                  <span className="px-2 py-0.5 rounded bg-blue-950/70 border border-blue-800 text-blue-300 font-bold">
                                                    {prd?.grade || 'L80'}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-slate-300">
                                                  {(prd?.thread_type === 'Premium' ? 'EUE' : prd?.thread_type) || 'BTC'}
                                                </td>
                                                <td className="px-3 py-2 text-white font-bold font-mono">
                                                  {item.invoice_quantity_mt ?? item.invoice_quantity ?? 0} MT
                                                </td>
                                                <td className="px-3 py-2 text-slate-300 font-mono">
                                                  {item.actual_quantity_mt ?? item.received_quantity ?? 0} MT
                                                </td>
                                                <td className="px-3 py-2 font-sans">
                                                  <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                      item.item_inspection_status === 'Accepted'
                                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                                        : item.item_inspection_status === 'Rejected'
                                                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                                                    }`}
                                                  >
                                                    {item.item_inspection_status || 'Pending QA'}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2 font-sans">
                                                  {itemTallies.length > 0 ? (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                      {itemTallies.map((ts) => (
                                                        <button
                                                          key={ts.ts_id}
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveSubTab('tally');
                                                          }}
                                                          className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono flex items-center space-x-1"
                                                          title="Click to view Tally Sheet"
                                                        >
                                                          <Barcode className="w-3 h-3 text-emerald-400" />
                                                          <span>
                                                            {ts.ts_id} ({(ts.tally_items || []).reduce((sum: number, ti: any) => sum + (ti.tube_count || 1), 0)} tubes / {ts.tally_items?.length || 0} lots)
                                                          </span>
                                                        </button>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenCreateTally(item.grn_item_id);
                                                      }}
                                                      className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center space-x-1"
                                                    >
                                                      <Plus className="w-3 h-3" />
                                                      <span>Create Tally Sheet</span>
                                                    </button>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-center font-sans">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleDeleteGrnLineItem(item.grn_item_id, g.grn_id, g.grn_items?.length || 1);
                                                    }}
                                                    className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-[10px] font-medium inline-flex items-center space-x-1 transition-colors"
                                                    title="Delete GRN Line Item"
                                                  >
                                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                                    <span>Delete</span>
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Lot Tally Sheets & Cutting Yield */}
      {activeSubTab === 'tally' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {tallySheets.map((ts) => (
              <div
                key={ts.ts_id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5 space-y-4"
              >
                {/* Tally Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center">
                      <Barcode className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-emerald-400">{ts.ts_id}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubTab('grn');
                            setExpandedGrn(ts.grn_item?.grn_id || null);
                          }}
                          className="text-xs bg-blue-950/80 hover:bg-blue-900 border border-blue-800 px-2 py-0.5 rounded text-blue-300 font-mono flex items-center space-x-1 cursor-pointer transition-colors"
                          title="Click to view parent GRN"
                        >
                          <Truck className="w-3 h-3" />
                          <span>GRN: {ts.grn_item?.grn_id || 'N/A'}</span>
                        </button>
                        <span className="text-xs bg-indigo-950/80 border border-indigo-800 px-2 py-0.5 rounded text-indigo-300 font-mono">
                          Item: {ts.grn_item_id}
                        </span>
                        {ts.heat_no && (
                          <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                            Heat: {ts.heat_no}
                          </span>
                        )}
                        {ts.lot_no && (
                          <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                            Lot: {ts.lot_no}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
                        <span>Date: <span className="text-slate-200 font-mono">{formatDate(ts.tally_sheet_date)}</span></span>
                        <span>•</span>
                        {ts.mill_test_certificate_no && (
                          <>
                            <span>MTC: <span className="text-slate-300 font-mono">{ts.mill_test_certificate_no}</span></span>
                            <span>•</span>
                          </>
                        )}
                        <span>PO: <span className="text-blue-300 font-mono">{ts.grn_item?.grn?.po_no || 'N/A'}</span></span>
                        <span>•</span>
                        <span>Supplier: <span className="text-slate-200">{ts.grn_item?.grn?.purchase_order?.supplier?.supplier_name || 'N/A'}</span></span>
                        <span>•</span>
                        <span>Insp: <span className="text-slate-300">{ts.inspector_name}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <button
                      onClick={() => handleOpenEditTally(ts)}
                      className="px-2.5 py-1 rounded bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-700 font-sans font-medium flex items-center space-x-1 transition-colors"
                      title="Edit Lot Tally Sheet & Inwarding Details"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Tally</span>
                    </button>
                    <button
                      onClick={() => setActiveMtcSheet(ts)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-sans font-medium flex items-center space-x-1"
                    >
                      <span>View MTC</span>
                    </button>
                    <button
                      onClick={() =>
                        exportToCsv(
                          `Tally_${ts.ts_id}_Lots`,
                          ts.tally_items?.map((item: any) => ({
                            Tally_Sheet_ID: ts.ts_id,
                            Lot_Tag_ID: item.ti_id,
                            Heat_No: item.heat_no || ts.heat_no,
                            Lot_No: item.lot_no || ts.lot_no,
                            MTC_No: item.mill_test_certificate_no || ts.mill_test_certificate_no,
                            Tubes_Count: item.tube_count || 1,
                            Total_Tube_Length_mm: item.tube_length_mm,
                            Parting_Length_mm: item.parting_length_mm,
                            Expected_Qty: item.expected_qty,
                            Rounded_Parts: item.rounded_qty,
                            End_Scrap_mm: item.end_scrap_mm,
                            Status: item.pipe_allocation_status,
                          })) || []
                        )
                      }
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 font-sans font-medium flex items-center space-x-1"
                    >
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTally(ts.ts_id)}
                      className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-800 font-sans font-medium flex items-center space-x-1 transition-colors"
                      title="Delete Tally Sheet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Tallied vs Invoice Length Validation Stat Pill */}
                    {(() => {
                      const totalLengthM = (ts.tally_items?.reduce((sum: number, item: any) => sum + (item.tube_length_mm || 0), 0) || 0) / 1000;
                      
                      // Resolve invoice length limit in meters:
                      // 1. Explicit invoice_quantity on GRN Item (standard in meters for tubular raw material)
                      // 2. PO Item ordered_qty (ordered length in meters)
                      // 3. Or derived from invoice_quantity_mt * 1000 / nominal_weight_kg_m
                      let invLengthM = Number(ts.grn_item?.invoice_quantity || 0);
                      if (!invLengthM && ts.grn_item?.po_item?.ordered_qty) {
                        invLengthM = Number(ts.grn_item.po_item.ordered_qty);
                      }
                      if (!invLengthM && ts.grn_item?.invoice_quantity_mt && ts.grn_item?.product?.nominal_weight_kg_m) {
                        invLengthM = Number(((ts.grn_item.invoice_quantity_mt * 1000) / ts.grn_item.product.nominal_weight_kg_m).toFixed(2));
                      }

                      const isOver = invLengthM > 0 && totalLengthM > (invLengthM + 0.001);
                      return (
                        <div
                          className={`px-3 py-1.5 rounded-lg border text-xs font-mono ${
                            isOver
                              ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <span className="text-slate-500 text-[9px] block font-sans uppercase">Tallied vs Invoice Length</span>
                          <div className="flex items-center space-x-1.5">
                            <span className={`font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {totalLengthM.toFixed(2)} m
                            </span>
                            <span className="text-slate-500">/</span>
                            <span className="text-slate-300">
                              {invLengthM > 0 ? `${invLengthM.toFixed(2)} m Max` : 'No Max'}
                            </span>
                          </div>
                          <span className={`text-[9px] block font-sans ${isOver ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                            {invLengthM > 0
                              ? isOver
                                ? '⚠️ Exceeds Invoice Length'
                                : '✓ Validated (≤ Invoice Length)'
                              : '✓ Length Validated'}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block font-sans uppercase">TOTAL LOTS</span>
                      <span className="text-emerald-400 font-bold font-mono">{ts.tally_items?.length || 0} Lots</span>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block font-sans uppercase">TOTAL TUBES</span>
                      <span className="text-white font-bold font-mono">
                        {ts.tally_items?.reduce((sum: number, item: any) => sum + (item.tube_count || 1), 0)} Tubes
                      </span>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block font-sans uppercase">TOTAL LENGTH</span>
                      <span className="text-cyan-300 font-bold font-mono">
                        {(ts.tally_items?.reduce((sum: number, item: any) => sum + (item.tube_length_mm || 0), 0) / 1000).toFixed(2)} m
                      </span>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block font-sans uppercase">EXPECTED PARTS</span>
                      <span className="text-amber-400 font-bold font-mono">
                        {ts.tally_items?.reduce((sum: number, item: any) => sum + (item.rounded_qty || 0), 0)} pcs
                      </span>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block font-sans uppercase">BUNDLES</span>
                      <span className="text-white font-bold font-mono">{ts.bundle_count}</span>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block font-sans uppercase">PRODUCT SPEC</span>
                      <span className="text-blue-400 font-bold block">
                        {ts.grn_item?.product?.size_od ? `${ts.grn_item?.product?.size_od}mm OD` : ''} {ts.grn_item?.product?.grade} {ts.grn_item?.product?.thread_type}
                      </span>
                      <span className="text-slate-400 text-[10px] block font-mono">
                        WT: {ts.grn_item?.product?.wall_thickness}mm ({ts.grn_item?.product?.schedule || 'Sch 80'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lot Items Table with Cutting Yield Math */}
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                      <tr>
                        <th className="px-3 py-2">Sr #</th>
                        <th className="px-3 py-2">Lot Tag / Barcode</th>
                        <th className="px-3 py-2">Heat Number</th>
                        <th className="px-3 py-2">Lot Number</th>
                        <th className="px-3 py-2">MTC Number</th>
                        <th className="px-3 py-2">Tubes (Qty)</th>
                        <th className="px-3 py-2">Total Tube Length (mm)</th>
                        <th className="px-3 py-2">Parting (mm)</th>
                        <th className="px-3 py-2">Expected Qty</th>
                        <th className="px-3 py-2">Rounded Parts</th>
                        <th className="px-3 py-2">End Scrap (mm)</th>
                        <th className="px-3 py-2">Yield %</th>
                        <th className="px-3 py-2">Allocation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {ts.tally_items?.map((item: any) => {
                        const yieldPct = (
                          ((item.rounded_qty * item.parting_length_mm) / item.tube_length_mm) * 100
                        ).toFixed(1);
                        return (
                          <tr key={item.ti_id} className="hover:bg-slate-850/40">
                            <td className="px-3 py-2 text-slate-500">{item.tube_sr_no}</td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => setActivePrintPipe({ ...item, tally_sheet: ts, product: ts.grn_item?.product })}
                                className="font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center space-x-1"
                                title="Click to view & print tag"
                              >
                                <span>{item.ti_id}</span>
                              </button>
                            </td>
                            <td className="px-3 py-2 text-blue-400 font-bold">{item.heat_no || ts.heat_no || 'N/A'}</td>
                            <td className="px-3 py-2 text-slate-200">{item.lot_no || ts.lot_no || 'N/A'}</td>
                            <td className="px-3 py-2 text-slate-400">{item.mill_test_certificate_no || ts.mill_test_certificate_no || 'N/A'}</td>
                            <td className="px-3 py-2 text-emerald-400 font-bold">{item.tube_count || 1} tubes</td>
                            <td className="px-3 py-2 text-slate-200">{item.tube_length_mm} mm</td>
                            <td className="px-3 py-2 text-slate-400">{item.parting_length_mm} mm</td>
                            <td className="px-3 py-2 text-slate-400">{item.expected_qty}</td>
                            <td className="px-3 py-2 font-bold text-emerald-400">{item.rounded_qty} pcs</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  item.end_scrap_mm > 500
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {item.end_scrap_mm} mm
                              </span>
                            </td>
                            <td className="px-3 py-2 text-emerald-400 font-bold">{yieldPct}%</td>
                            <td className="px-3 py-2 font-sans">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  item.pipe_allocation_status === 'Available'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : item.pipe_allocation_status === 'Allocated'
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                    : item.pipe_allocation_status === 'Consumed'
                                    ? 'bg-slate-800 text-slate-400'
                                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                                }`}
                              >
                                {item.pipe_allocation_status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log GRN Modal */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isEditGrnMode ? 'Edit Goods Receipt & Weighbridge Entry' : 'Log Goods Receipt & Weighbridge Entry'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isEditGrnMode
                    ? 'Modify invoice metadata, weighbridge reconciliation, and edit line items (Size, Grade, Thread, Qty).'
                    : 'Gate weighbridge weight difference validation and pipe line items inwarding.'}
                </p>
              </div>
              <button onClick={() => setIsGrnModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateGRN} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    GRN ID {isEditGrnMode && <span className="text-[10px] text-slate-500">(Locked during edit)</span>}
                  </label>
                  <input
                    type="text"
                    value={grnForm.grn_id}
                    onChange={(e) => setGrnForm({ ...grnForm, grn_id: e.target.value })}
                    disabled={isEditGrnMode}
                    required
                    className={`w-full border rounded px-3 py-1.5 text-slate-200 font-mono ${
                      isEditGrnMode
                        ? 'bg-slate-900/50 border-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Purchase Order Reference</label>
                  <select
                    value={grnForm.po_no}
                    onChange={(e) => {
                      const selectedPo = purchaseOrders.find((p) => p.po_no === e.target.value);
                      setGrnForm((prev) => ({
                        ...prev,
                        po_no: e.target.value,
                        items: (selectedPo?.po_items && selectedPo.po_items.length > 0)
                          ? selectedPo.po_items.map((poi: any) => ({
                              po_item_id: poi.po_item_id,
                              product_id: poi.product_id,
                              size: poi.product?.size_od ? `${poi.product.size_od}mm OD` : '177.8mm OD',
                              grade: poi.product?.grade || 'L80',
                              thread: (poi.product?.thread_type === 'Premium' ? 'EUE' : poi.product?.thread_type) || 'BTC',
                              invoice_quantity_mt: '',
                              actual_quantity_mt: '',
                            }))
                          : [
                              {
                                po_item_id: '',
                                product_id: '',
                                size: '177.8mm OD',
                                grade: 'L80',
                                thread: 'BTC',
                                invoice_quantity_mt: '',
                                actual_quantity_mt: '',
                              },
                            ],
                      }));
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 font-mono"
                  >
                    {purchaseOrders.map((p) => (
                      <option key={p.po_no} value={p.po_no}>
                        {p.po_no} ({p.supplier?.supplier_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PO Ordered MT Reconciliation Gate Card */}
              {activeSelectedPo && (
                <div
                  className={`p-3.5 rounded-xl border text-xs transition-all ${
                    isInvoiceMtExceeded
                      ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                      <Scale className="w-3.5 h-3.5 text-blue-400" />
                      <span>PO Ordered MT Reconciliation Gate</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isInvoiceMtExceeded
                          ? 'bg-rose-600 text-white animate-pulse'
                          : autoCalculatedInvoiceWeightMt === 0
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                      }`}
                    >
                      {isInvoiceMtExceeded
                        ? `⚠️ Exceeds PO Limit (+${(poWeightGate.newCumulativeInvoiceMt - poTotalOrderedMt).toFixed(3)} MT)`
                        : autoCalculatedInvoiceWeightMt === 0
                        ? `Max Available: ${poWeightGate.remainingAllowableMt.toFixed(3)} MT`
                        : `✓ Validated (≤ PO Limit)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono">
                    <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                      <div className="text-slate-400 text-[10px] font-sans">PO Total Ordered</div>
                      <div className="font-bold text-white mt-0.5">{poTotalOrderedMt.toFixed(3)} MT</div>
                    </div>
                    <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                      <div className="text-slate-400 text-[10px] font-sans">Prior GRNs Invoiced</div>
                      <div className="font-bold text-amber-300 mt-0.5">{existingGrnInvoiceMt.toFixed(3)} MT</div>
                    </div>
                    <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                      <div className="text-slate-400 text-[10px] font-sans">This GRN Invoice MT</div>
                      <div className="font-bold text-blue-300 mt-0.5">
                        {autoCalculatedInvoiceWeightMt > 0 ? `${autoCalculatedInvoiceWeightMt.toFixed(3)} MT` : '0.000 MT'}
                      </div>
                    </div>
                    <div
                      className={`p-2 rounded border ${
                        isInvoiceMtExceeded
                          ? 'bg-rose-950/80 border-rose-700 text-rose-300 font-bold'
                          : 'bg-slate-900/90 border-slate-800 text-emerald-400 font-bold'
                      }`}
                    >
                      <div className="text-slate-400 text-[10px] font-sans">Cumulative / Remaining</div>
                      <div className="mt-0.5">
                        {poWeightGate.newCumulativeInvoiceMt.toFixed(3)} / {Math.max(0, poTotalOrderedMt - poWeightGate.newCumulativeInvoiceMt).toFixed(3)} MT
                      </div>
                    </div>
                  </div>

                  {isInvoiceMtExceeded && (
                    <div className="mt-2.5 p-2 rounded bg-rose-950/90 border border-rose-700 text-rose-200 font-sans text-[11px] flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>
                        Total GRN Invoice Weight ({poWeightGate.newCumulativeInvoiceMt.toFixed(3)} MT) exceeds PO {grnForm.po_no}&apos;s
                        Ordered Weight ({poTotalOrderedMt.toFixed(3)} MT). Remaining allowable MT is{' '}
                        <strong>{poWeightGate.remainingAllowableMt.toFixed(3)} MT</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-TEN-9022"
                    value={grnForm.invoice_no}
                    onChange={(e) => setGrnForm({ ...grnForm, invoice_no: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={grnForm.invoice_date}
                    onChange={(e) => setGrnForm({ ...grnForm, invoice_date: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Transporter / Vehicle #</label>
                  <input
                    type="text"
                    placeholder="e.g. TRUCK-MH-12-8821"
                    value={grnForm.vehicle_transporter_no}
                    onChange={(e) => setGrnForm({ ...grnForm, vehicle_transporter_no: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Weighbridge Delta Verification Box */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                  <Scale className="w-4 h-4 text-blue-400" />
                  <span>Weighbridge Weight Reconciliation Gate</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5">
                        <label className="block text-slate-400 text-[11px]">Invoice Weight (MT)</label>
                        <span className="text-[9px] text-blue-300 font-mono bg-blue-950/80 border border-blue-800/80 px-1.5 py-0.2 rounded font-medium">
                          Auto-calculated
                        </span>
                      </div>
                      {activeSelectedPo && (
                        <span className="text-[10px] text-slate-400">
                          Max: <strong className={isInvoiceMtExceeded ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{poWeightGate.remainingAllowableMt.toFixed(3)} MT</strong>
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      readOnly
                      placeholder="Auto from Line Items"
                      value={autoCalculatedInvoiceWeightMt > 0 ? autoCalculatedInvoiceWeightMt : ''}
                      className={`w-full bg-slate-950/90 border rounded px-2.5 py-1.5 text-slate-200 font-mono font-bold text-xs cursor-default ${
                        isInvoiceMtExceeded ? 'border-rose-500 text-rose-200 ring-1 ring-rose-500 bg-rose-950/20' : 'border-slate-800'
                      }`}
                    />
                    {isInvoiceMtExceeded && (
                      <p className="text-[10px] text-rose-400 mt-1 font-sans font-semibold">
                        ⚠️ Exceeds max allowable {poWeightGate.remainingAllowableMt.toFixed(3)} MT
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5">
                        <label className="block text-slate-400 text-[11px]">Actual Weighbridge (MT)</label>
                        <span className="text-[9px] text-blue-300 font-mono bg-blue-950/80 border border-blue-800/80 px-1.5 py-0.2 rounded font-medium">
                          Auto-calculated
                        </span>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      readOnly
                      placeholder="Auto from Line Items"
                      value={autoCalculatedActualWeighbridgeMt > 0 ? autoCalculatedActualWeighbridgeMt : ''}
                      className="w-full bg-slate-950/90 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono font-bold text-xs cursor-default"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Weight Delta (Calculated)</label>
                    <div
                      className={`font-mono text-sm font-bold p-1 rounded ${
                        !hasWeighbridgeValues
                          ? 'text-slate-400'
                          : weighbridgeCalc.weightDifferenceMt < 0
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {!hasWeighbridgeValues ? (
                        <span className="text-slate-500 font-normal text-xs">— (Enter item weights)</span>
                      ) : (
                        <>
                          {weighbridgeCalc.weightDifferenceMt > 0 ? '+' : ''}
                          {weighbridgeCalc.weightDifferenceMt} MT ({weighbridgeCalc.variancePct}%)
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* GRN Line Items Inwarding Section (Required User Entry) */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <PackageCheck className="w-4 h-4 text-emerald-400" />
                    <span>GRN Line Items Inwarding (Required User Entry)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {activeSelectedPo && (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                          isTotalInvoiceMtExceeded
                            ? 'bg-rose-950 border border-rose-700 text-rose-300 font-bold'
                            : 'bg-slate-900 border border-slate-800 text-slate-300'
                        }`}
                      >
                        Sum MT: <strong className={isTotalInvoiceMtExceeded ? 'text-rose-400' : 'text-blue-300'}>{currentGrnItemsMtTotal.toFixed(3)}</strong> / {remainingAllowableInvoiceMt.toFixed(3)} Rem (PO: {poTotalOrderedMt.toFixed(3)} MT)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleAddGrnLineItem}
                      className="px-2.5 py-1 rounded bg-blue-900/60 hover:bg-blue-800 border border-blue-700 text-blue-200 text-[11px] font-medium flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Line Item</span>
                    </button>
                  </div>
                </div>

                {isTotalInvoiceMtExceeded && (
                  <div className="p-2.5 rounded bg-rose-950/90 border border-rose-700 text-rose-200 text-[11px] flex items-center space-x-1.5 font-sans">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>
                      ⚠️ Validation Error: Sum of all &quot;Qty as per invoice (MT)&quot; ({(currentGrnItemsMtTotal + existingGrnInvoiceMtSum).toFixed(3)} MT) associated with PO {grnForm.po_no} exceeds PO&apos;s Total Ordered MT ({poTotalOrderedMt.toFixed(3)} MT). Already received in earlier GRNs: {existingGrnInvoiceMtSum.toFixed(3)} MT. Remaining allowable across this GRN is <strong>{remainingAllowableInvoiceMt.toFixed(3)} MT</strong>.
                    </span>
                  </div>
                )}

                {grnForm.items.length === 0 ? (
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-400 text-center text-xs">
                    No line items added yet. Click &quot;+ Add Line Item&quot; to add.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/80">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                          <tr>
                            <th className="px-3 py-2 w-1/5">Size</th>
                            <th className="px-3 py-2 w-1/6">Grade</th>
                            <th className="px-3 py-2 w-1/6">Thread</th>
                            <th className="px-3 py-2 w-1/4">Qty as per invoice (MT)</th>
                            <th className="px-3 py-2 w-1/4">Actual Qty (MT)</th>
                            <th className="px-2 py-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {grnForm.items.map((item, idx) => (
                            <tr
                              key={idx}
                              className="bg-slate-900/70 hover:bg-slate-850/50 transition-colors"
                            >
                              {/* 1. Size */}
                              <td className="px-3 py-2.5">
                                <input
                                  type="text"
                                  list="grn-sizes"
                                  required
                                  placeholder='e.g. 7" (177.8mm) or 177.8'
                                  value={item.size}
                                  onChange={(e) =>
                                    handleUpdateGrnLineItem(idx, 'size', e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                                />
                              </td>

                              {/* 2. Grade */}
                              <td className="px-3 py-2.5">
                                <select
                                  value={item.grade}
                                  onChange={(e) =>
                                    handleUpdateGrnLineItem(idx, 'grade', e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                                >
                                  <option value="J55">J55</option>
                                  <option value="K55">K55</option>
                                  <option value="L80">L80</option>
                                  <option value="N80">N80</option>
                                  <option value="P110">P110</option>
                                  <option value="Q125">Q125</option>
                                  <option value="13Cr">13Cr</option>
                                </select>
                              </td>

                              {/* 3. Thread */}
                              <td className="px-3 py-2.5">
                                <select
                                  value={item.thread === 'Premium' ? 'EUE' : item.thread}
                                  onChange={(e) =>
                                    handleUpdateGrnLineItem(idx, 'thread', e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs focus:border-blue-500"
                                >
                                  <option value="BTC">BTC (Buttress)</option>
                                  <option value="LTC">LTC (Long Thread)</option>
                                  <option value="STC">STC (Short Thread)</option>
                                  <option value="EUE">EUE (External Upset End)</option>
                                  <option value="NU">NU(Non-Upset)</option>
                                  <option value="Plain End">Plain End</option>
                                </select>
                              </td>

                              {/* 4. Qty as per invoice (MT) */}
                              <td className="px-3 py-2.5">
                                {(() => {
                                  const selectedPo = purchaseOrders.find((p) => p.po_no === grnForm.po_no);
                                  const matchedPoi = resolvePoiForGrnItem(item, idx, selectedPo);
                                  const poOrderedMt = matchedPoi ? Number(matchedPoi.ordered_qty_mt) : null;

                                  const prevInvoicedMt = matchedPoi ? otherGrnsForPo.reduce((sum, g) => {
                                    const mItems = (g.grn_items || []).filter((gi: any) => gi.po_item_id === matchedPoi.po_item_id);
                                    return sum + mItems.reduce((s: number, gi: any) => s + (Number(gi.invoice_quantity_mt) || 0), 0);
                                  }, 0) : 0;

                                  const otherRowsForSamePoiMt = grnForm.items
                                    .filter((r, i) => {
                                      if (i === idx) return false;
                                      const rPoi = resolvePoiForGrnItem(r, i, selectedPo);
                                      return rPoi?.po_item_id === matchedPoi?.po_item_id;
                                    })
                                    .reduce((sum, r) => {
                                      const v = Number(r.invoice_quantity_mt);
                                      return sum + (!isNaN(v) && v > 0 ? v : 0);
                                    }, 0);

                                  const otherRowsInFormTotalMt = grnForm.items
                                    .filter((_, i) => i !== idx)
                                    .reduce((sum, r) => {
                                      const v = Number(r.invoice_quantity_mt);
                                      return sum + (!isNaN(v) && v > 0 ? v : 0);
                                    }, 0);

                                  const poOverallRemaining = Math.max(0, poTotalOrderedMt - existingGrnInvoiceMtSum - otherRowsInFormTotalMt);
                                  const itemRemaining = poOrderedMt !== null
                                    ? Math.max(0, poOrderedMt - prevInvoicedMt - otherRowsForSamePoiMt)
                                    : poOverallRemaining;
                                  const remainingAllowable = Math.min(poOverallRemaining, itemRemaining);

                                  const val = parseFloat(String(item.invoice_quantity_mt));
                                  const isOverOrdered = poOrderedMt !== null && !isNaN(val) && val > poOrderedMt + 0.0001;
                                  const isOverRemaining = remainingAllowable !== null && !isNaN(val) && val > remainingAllowable + 0.0001;
                                  const hasError = isOverOrdered || isOverRemaining;

                                  return (
                                    <div className="space-y-1">
                                      {selectedPo?.po_items && selectedPo.po_items.length > 1 && (
                                        <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                                          <span>PO Line:</span>
                                          <select
                                            value={item.po_item_id || matchedPoi?.po_item_id || ''}
                                            onChange={(e) => {
                                              const targetPoi = selectedPo.po_items.find((p: any) => p.po_item_id === e.target.value);
                                              if (targetPoi) {
                                                handleUpdateGrnLineItem(idx, 'po_item_id', targetPoi.po_item_id);
                                                if (targetPoi.product) {
                                                  handleUpdateGrnLineItem(idx, 'product_id', targetPoi.product_id);
                                                  handleUpdateGrnLineItem(idx, 'size', targetPoi.product.size_od ? `${targetPoi.product.size_od}mm OD` : item.size);
                                                  handleUpdateGrnLineItem(idx, 'grade', targetPoi.product.grade || item.grade);
                                                  handleUpdateGrnLineItem(idx, 'thread', targetPoi.product.thread_type || item.thread);
                                                }
                                              }
                                            }}
                                            className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-blue-300 font-bold text-[10px]"
                                          >
                                            {selectedPo.po_items.map((poi: any) => (
                                              <option key={poi.po_item_id} value={poi.po_item_id}>
                                                {poi.po_item_id} ({poi.product?.size_od}mm - {poi.ordered_qty_mt} MT)
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                      <input
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        placeholder="0.000 MT *"
                                        value={item.invoice_quantity_mt}
                                        onChange={(e) =>
                                          handleUpdateGrnLineItem(idx, 'invoice_quantity_mt', e.target.value)
                                        }
                                        required
                                        className={`w-full bg-slate-950 border rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs ${
                                          hasError
                                            ? 'border-rose-500 text-rose-200 ring-1 ring-rose-500'
                                            : item.invoice_quantity_mt === ''
                                            ? 'border-amber-500/80 ring-1 ring-amber-500/50'
                                            : 'border-slate-700'
                                        }`}
                                      />
                                      {poOrderedMt !== null && (
                                        <div className="text-[10px] font-sans flex items-center justify-between text-slate-400">
                                          <span>PO Ord: <strong className="text-slate-300 font-mono">{poOrderedMt.toFixed(3)} MT</strong></span>
                                          <span className={remainingAllowable !== null && remainingAllowable <= 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                                            Rem: <strong className="font-mono">{remainingAllowable?.toFixed(3)} MT</strong>
                                          </span>
                                        </div>
                                      )}
                                      {hasError && (
                                        <p className="text-[10px] text-rose-400 font-sans font-semibold">
                                          {isOverOrdered
                                            ? `⚠️ Exceeds PO Item Ordered MT (${poOrderedMt.toFixed(3)} MT)`
                                            : `⚠️ Exceeds PO remaining allowable (${remainingAllowable?.toFixed(3)} MT)`}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* 5. Actual Qty (MT) */}
                              <td className="px-3 py-2.5">
                                <div className="space-y-1">
                                  <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    placeholder="0.000 MT *"
                                    value={item.actual_quantity_mt}
                                    onChange={(e) =>
                                      handleUpdateGrnLineItem(idx, 'actual_quantity_mt', e.target.value)
                                    }
                                    required
                                    className={`w-full bg-slate-950 border rounded px-2.5 py-1 text-slate-200 font-mono font-bold text-xs ${
                                      item.actual_quantity_mt === ''
                                        ? 'border-amber-500/80 ring-1 ring-amber-500/50'
                                        : 'border-slate-700'
                                    }`}
                                  />
                                  <div className="text-[10px] text-slate-500 font-sans">
                                    Weighbridge Net MT
                                  </div>
                                </div>
                              </td>

                              {/* Remove button */}
                              <td className="px-2 py-2.5 text-center">
                                {grnForm.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveGrnLineItem(idx)}
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                                    title="Remove Line Item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <datalist id="grn-sizes">
                  <option value='2-3/8" (60.3mm)' />
                  <option value='2-7/8" (73.0mm)' />
                  <option value='3-1/2" (88.9mm)' />
                  <option value='4-1/2" (114.3mm)' />
                  <option value='5" (127.0mm)' />
                  <option value='5-1/2" (139.7mm)' />
                  <option value='7" (177.8mm)' />
                  <option value='9-5/8" (244.5mm)' />
                  <option value='13-3/8" (339.7mm)' />
                  <option value="177.8mm OD" />
                  <option value="88.9mm OD" />
                  <option value="139.7mm OD" />
                  <option value="244.5mm OD" />
                </datalist>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsGrnModalOpen(false)}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isInvoiceMtExceeded || isTotalInvoiceMtExceeded || hasAnyItemQtyExceeded}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        isInvoiceMtExceeded || isTotalInvoiceMtExceeded || hasAnyItemQtyExceeded
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                      }`}
                    >
                      {isEditGrnMode ? 'Update GRN Record' : 'Save GRN Record'}
                    </button>
                  </div>
                  {isInvoiceMtExceeded && (
                    <span className="text-[10px] text-rose-400 font-sans font-medium">
                      ⚠️ Total Invoice Weight exceeds PO Ordered Weight ({poTotalOrderedMt.toFixed(3)} MT).
                    </span>
                  )}
                  {isTotalInvoiceMtExceeded && (
                    <span className="text-[10px] text-rose-400 font-sans font-medium">
                      ⚠️ Sum of all &quot;Qty as per invoice (MT)&quot; ({(currentGrnItemsMtTotal + existingGrnInvoiceMtSum).toFixed(3)} MT) exceeds PO Total Ordered MT ({poTotalOrderedMt.toFixed(3)} MT).
                    </span>
                  )}
                  {hasAnyItemQtyExceeded && (
                    <span className="text-[10px] text-rose-400 font-sans font-medium">
                      ⚠️ One or more line items exceed the PO Ordered MT or remaining allowable MT.
                    </span>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Lot Tally Sheet Modal with Bulk Length Inwarding */}
      {isTallyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isEditTallyMode ? 'Edit Lot Tally Sheet & Cutting Yield Log' : 'New Lot Tally Sheet & Cutting Yield Log'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isEditTallyMode
                    ? 'Modify lot-by-lot tube counts, total lengths, parting measurements, and recalculate yields.'
                    : 'Enter lot-by-lot tube counts and total combined tube lengths for automated yield, expected parts, and scrap calculation.'}
                </p>
              </div>
              <button onClick={() => setIsTallyModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTally} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Tally Sheet ID</label>
                  <input
                    type="text"
                    value={tallyForm.ts_id}
                    onChange={(e) => setTallyForm({ ...tallyForm, ts_id: e.target.value })}
                    required
                    readOnly={isEditTallyMode}
                    className={`w-full border rounded px-2 py-1.5 font-mono ${
                      isEditTallyMode
                        ? 'bg-slate-900 border-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-blue-400">
                    Source GRN & Item
                  </label>
                  <select
                    value={tallyForm.grn_item_id}
                    onChange={(e) => {
                      const newGrnItemId = e.target.value;
                      const selectedItem = grns.flatMap((g) => g.grn_items || []).find((i) => i.grn_item_id === newGrnItemId);
                      const matched = findMatchingCouplingLength(
                        selectedItem?.product?.size_od || selectedItem?.product?.product_description,
                        selectedItem?.product?.thread_type
                      );
                      const newParting = (!isCustomPartingLength && matched) ? matched : tallyForm.defaultPartingLength;
                      setTallyForm((prev) => ({
                        ...prev,
                        grn_item_id: newGrnItemId,
                        defaultPartingLength: newParting,
                        lots: prev.lots.map((p) => ({ ...p, parting_length_mm: newParting })),
                      }));
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono text-xs"
                  >
                    <option value="">-- Choose GRN Item --</option>
                    {grns.flatMap((g) =>
                      (g.grn_items || []).map((item: any) => (
                        <option key={item.grn_item_id} value={item.grn_item_id}>
                          {g.grn_id} ({g.po_no}) → {item.grn_item_id} [{item.product?.grade} {item.product?.size_od}mm]
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Default Heat Number</label>
                  <input
                    type="text"
                    placeholder="HT-84920"
                    value={tallyForm.heat_no}
                    onChange={(e) => handleDefaultHeatChange(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono font-bold text-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Default Lot Number</label>
                  <input
                    type="text"
                    placeholder="LOT-2026-A1"
                    value={tallyForm.lot_no}
                    onChange={(e) => setTallyForm({ ...tallyForm, lot_no: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Default MTC Number</label>
                  <input
                    type="text"
                    placeholder="MTC-TEN-84920-REV1"
                    value={tallyForm.mill_test_certificate_no}
                    onChange={(e) => setTallyForm({ ...tallyForm, mill_test_certificate_no: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Inspector Name</label>
                  <input
                    type="text"
                    value={tallyForm.inspector_name}
                    onChange={(e) => setTallyForm({ ...tallyForm, inspector_name: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Bundle Count</label>
                  <input
                    type="number"
                    value={tallyForm.bundle_count}
                    onChange={(e) => setTallyForm({ ...tallyForm, bundle_count: parseInt(e.target.value) || 1 })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400 text-xs font-semibold">
                      Target Parting Length (Coupling Size)
                    </label>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                      {tallyForm.defaultPartingLength} mm
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <select
                      value={
                        isCustomPartingLength ||
                        !COUPLING_LENGTH_SPECS.some((s) => s.length_mm === tallyForm.defaultPartingLength)
                          ? 'custom'
                          : tallyForm.defaultPartingLength
                      }
                      onChange={(e) => {
                        const selVal = e.target.value;
                        if (selVal === 'custom') {
                          setIsCustomPartingLength(true);
                        } else {
                          setIsCustomPartingLength(false);
                          const val = parseFloat(selVal) || 135;
                          setTallyForm((prev) => ({
                            ...prev,
                            defaultPartingLength: val,
                            lots: prev.lots.map((p) => ({ ...p, parting_length_mm: val })),
                          }));
                        }
                      }}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono text-xs font-bold text-emerald-400 focus:border-emerald-500"
                    >
                      <option value="" disabled>-- Select Coupling Size / Length --</option>
                      <optgroup label="── Tubing Coupling Sizes (API 5CT) ──">
                        {COUPLING_LENGTH_SPECS.filter((s) => s.category === 'Tubing').map((s, idx) => (
                          <option key={`tb-${idx}`} value={s.length_mm}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="── Casing Coupling Sizes (API 5CT) ──">
                        {COUPLING_LENGTH_SPECS.filter((s) => s.category === 'Casing').map((s, idx) => (
                          <option key={`cs-${idx}`} value={s.length_mm}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                      <option value="custom">⚙️ Custom Parting Length (Manual Entry)...</option>
                    </select>

                    {(isCustomPartingLength ||
                      !COUPLING_LENGTH_SPECS.some((s) => s.length_mm === tallyForm.defaultPartingLength)) && (
                      <div className="flex items-center space-x-1.5 pt-1">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder="Enter custom parting length..."
                          value={tallyForm.defaultPartingLength}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setTallyForm((prev) => ({
                              ...prev,
                              defaultPartingLength: val,
                              lots: prev.lots.map((p) => ({ ...p, parting_length_mm: val })),
                            }));
                          }}
                          required
                          className="w-full bg-slate-950 border border-amber-600/80 rounded px-2 py-1 text-amber-300 font-mono font-bold text-xs focus:ring-1 focus:ring-amber-500"
                        />
                        <span className="text-xs text-amber-400 font-mono font-bold shrink-0">mm</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Bulk Lot Grid with Live Cutting Yield Formula */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Scissors className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        Lot-by-Lot Dimensional Inwarding ({tallyForm.lots.length} Lot{tallyForm.lots.length === 1 ? '' : 's'})
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Under one GRN Item there can be multiple Heat Numbers, and under each Heat Number there can be multiple Lot Numbers. &quot;Total Tube Length (mm)&quot; represents total length of all tubes in that lot.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    {(() => {
                      const formTotalLengthM = (tallyForm.lots.reduce((sum, l) => sum + (Number(l.tube_length_mm) || 0), 0)) / 1000;
                      const currentGrnItem = grns.flatMap((g) => g.grn_items || []).find((i: any) => i.grn_item_id === tallyForm.grn_item_id);
                      let invLimitM = Number(currentGrnItem?.invoice_quantity || 0);
                      if (!invLimitM && currentGrnItem?.po_item?.ordered_qty) {
                        invLimitM = Number(currentGrnItem.po_item.ordered_qty);
                      }
                      if (!invLimitM && currentGrnItem?.invoice_quantity_mt && currentGrnItem?.product?.nominal_weight_kg_m) {
                        invLimitM = Number(((currentGrnItem.invoice_quantity_mt * 1000) / currentGrnItem.product.nominal_weight_kg_m).toFixed(2));
                      }
                      const isFormOver = invLimitM > 0 && formTotalLengthM > (invLimitM + 0.001);

                      return (
                        <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center space-x-1.5 ${
                          isFormOver ? 'bg-rose-950/80 border-rose-700 text-rose-300' : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}>
                          <span className="text-slate-400 text-[10px]">Total Length:</span>
                          <span className={`font-bold ${isFormOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formTotalLengthM.toFixed(2)} m
                          </span>
                          {invLimitM > 0 && (
                            <span className="text-slate-500 text-[10px]">
                              / {invLimitM.toFixed(2)} m Max {isFormOver ? '(⚠️ Exceeds Limit)' : '(✓ OK)'}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={handleAddLot}
                      className="px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 border bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border-emerald-700 cursor-pointer transition-all shrink-0 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Lot Row</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {tallyForm.lots.map((lot, idx) => {
                    const calc = calculateCuttingYield(lot.tube_length_mm, lot.parting_length_mm);
                    const cleanTag = (lot.ti_id || '').trim().toUpperCase();
                    const isDuplicateInForm = cleanTag !== '' && tallyForm.lots.some(
                      (l, i) => i !== idx && (l.ti_id || '').trim().toUpperCase() === cleanTag
                    );
                    const existingSheetCollision = cleanTag !== '' && tallySheets.find(
                      (ts) =>
                        (!isEditTallyMode || ts.ts_id !== tallyForm.ts_id) &&
                        (ts.tally_items || []).some(
                          (ti: any) => (ti.ti_id || '').trim().toUpperCase() === cleanTag
                        )
                    );

                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5 text-xs shadow-md"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-300 text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              Lot Entry #{lot.tube_sr_no}
                            </span>
                            <span className="font-mono text-xs text-amber-400 font-bold">
                              Tag: {lot.ti_id}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLot(idx)}
                            disabled={tallyForm.lots.length === 1}
                            className="p-1 rounded text-rose-400 hover:bg-rose-950/60 disabled:text-slate-700 transition-colors"
                            title={tallyForm.lots.length === 1 ? 'At least one lot row is required' : 'Remove lot row'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Top row: Heat No, Lot No, MTC, Tubes Qty, Total Tube Length, Parting */}
                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                          <div>
                            <label className="text-[10px] text-blue-400 block mb-1 font-semibold">Heat Number *</label>
                            <input
                              type="text"
                              value={lot.heat_no}
                              onChange={(e) => handleLotChange(idx, 'heat_no', e.target.value)}
                              required
                              placeholder="e.g. HT-99142"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono font-bold text-blue-400"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-300 block mb-1 font-semibold">Lot Number *</label>
                            <input
                              type="text"
                              value={lot.lot_no}
                              onChange={(e) => handleLotChange(idx, 'lot_no', e.target.value)}
                              required
                              placeholder="e.g. LOT-2026-B1"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">MTC Number</label>
                            <input
                              type="text"
                              value={lot.mill_test_certificate_no}
                              onChange={(e) => handleLotChange(idx, 'mill_test_certificate_no', e.target.value)}
                              placeholder="e.g. MTC-REV1"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-300"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-emerald-400 block mb-1 font-semibold">Tubes in Lot (Qty) *</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={lot.tube_count}
                              onChange={(e) => handleLotChange(idx, 'tube_count', parseInt(e.target.value) || 1)}
                              required
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono font-bold text-emerald-400"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-slate-200 block font-semibold">Total Tube Length *</label>
                              <span className="text-[9px] text-slate-500 font-mono">(Lot mm)</span>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                step="1"
                                min="1"
                                value={lot.tube_length_mm}
                                onChange={(e) => handleLotChange(idx, 'tube_length_mm', parseFloat(e.target.value) || 0)}
                                required
                                placeholder="Total lot mm..."
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono font-bold pr-7"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">mm</span>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Parting Length *</label>
                            <div className="relative">
                              <input
                                type="number"
                                step="1"
                                min="1"
                                value={lot.parting_length_mm}
                                onChange={(e) =>
                                  handleLotChange(idx, 'parting_length_mm', parseFloat(e.target.value) || 0)
                                }
                                required
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono pr-7"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">mm</span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: Barcode / Lot Tag & Live Cutting Yield Box */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-1 border-t border-slate-900">
                          <div className="sm:col-span-4">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-500 block">Lot Tag / Barcode</label>
                              {(isDuplicateInForm || existingSheetCollision) && (
                                <span className="text-[9px] text-rose-400 font-medium">Duplicate</span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={lot.ti_id}
                              onChange={(e) => handleLotChange(idx, 'ti_id', e.target.value)}
                              required
                              className={`w-full bg-slate-900 border rounded px-2 py-1 font-mono font-bold ${
                                isDuplicateInForm || existingSheetCollision
                                  ? 'border-rose-500 text-rose-300 focus:ring-1 focus:ring-rose-500'
                                  : 'border-slate-700 text-amber-400'
                              }`}
                            />
                            {isDuplicateInForm && (
                              <span className="text-[9px] text-rose-400 block mt-0.5">⚠️ Duplicate barcode in form</span>
                            )}
                            {!isDuplicateInForm && existingSheetCollision && (
                              <span className="text-[9px] text-rose-400 block mt-0.5 truncate" title={`Already used in ${existingSheetCollision.ts_id}`}>
                                ⚠️ In {existingSheetCollision.ts_id}
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-8 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 font-mono text-xs flex justify-around items-center">
                            <div>
                              <span className="text-slate-500 text-[9px] block uppercase font-sans">Expected Parts (Yield)</span>
                              <span className="text-emerald-400 font-bold text-sm">{calc.roundedQty} pcs</span>
                              <span className="text-slate-500 text-[9px] block">({calc.expectedQty.toFixed(2)} exact)</span>
                            </div>
                            <div className="h-6 w-px bg-slate-800"></div>
                            <div>
                              <span className="text-slate-500 text-[9px] block uppercase font-sans">End Scrap</span>
                              <span className="text-amber-400 font-bold">{calc.endScrapMm} mm</span>
                            </div>
                            <div className="h-6 w-px bg-slate-800"></div>
                            <div>
                              <span className="text-slate-500 text-[9px] block uppercase font-sans">Cutting Yield</span>
                              <span className="text-blue-400 font-bold text-sm">{calc.yieldPct}%</span>
                            </div>
                            <div className="h-6 w-px bg-slate-800"></div>
                            <div>
                              <span className="text-slate-500 text-[9px] block uppercase font-sans">Avg Length / Tube</span>
                              <span className="text-slate-300 font-bold">
                                {(lot.tube_length_mm / (lot.tube_count || 1)).toFixed(0)} mm
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsTallyModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-lg shadow-emerald-600/20"
                >
                  {isEditTallyMode ? 'Update Lot Tally Sheet' : 'Save Lot Tally Sheet & Generate Barcodes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tube Tag Print Preview Modal */}
      {activePrintPipe && (
        <TagPrintModal
          pipe={activePrintPipe}
          tallySheet={activePrintPipe.tally_sheet}
          product={activePrintPipe.product}
          onClose={() => setActivePrintPipe(null)}
        />
      )}

      {/* Mill Test Certificate Viewer Modal */}
      {activeMtcSheet && (
        <MtcViewerModal
          tallySheet={activeMtcSheet}
          product={activeMtcSheet.grn_item?.product}
          supplier={activeMtcSheet.grn_item?.grn?.purchase_order?.supplier}
          onClose={() => setActiveMtcSheet(null)}
        />
      )}
    </div>
  );
}
