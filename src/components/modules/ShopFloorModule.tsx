'use client';

import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  X, 
  ChevronRight, 
  Scale, 
  Cpu, 
  Clock, 
  ShieldAlert,
  ArrowRight,
  Layers,
  ShoppingCart,
  Package,
  Boxes,
  Pencil,
  Trash2
} from 'lucide-react';
import { PROCESS_STAGES, DEFECT_CATEGORIES, DISPOSITION_ACTIONS, SHIFTS } from '@/lib/types';
import { validateProductionBalance, validateWorkOrderStageQuantityLimit, formatDate, formatDateTime } from '@/lib/calculations';

// Specification normalization helpers for seamless matching
function normalizeSize(s: string | number | null | undefined): string {
  if (!s) return '';
  const str = String(s).toLowerCase().trim();
  const clean = str.replace(/[-_]/g, ' ').replace(/["”’']/g, '').replace(/\s+/g, ' ').trim();

  if (str.includes('177.8') || clean === '7' || clean.startsWith('7 in') || clean.startsWith('7 ')) return '7 in (177.8 mm)';
  if (str.includes('244.48') || str.includes('244.5') || clean.includes('9 5/8') || clean.includes('9.625')) return '9-5/8 in (244.5 mm)';
  if (str.includes('139.7') || clean.includes('5 1/2') || clean.includes('5.5')) return '5-1/2 in (139.7 mm)';
  if (str.includes('114.3') || clean.includes('4 1/2') || clean.includes('4.5')) return '4-1/2 in (114.3 mm)';
  if (str.includes('88.9') || clean.includes('3 1/2') || clean.includes('3.5')) return '3-1/2 in (88.9 mm)';
  if (str.includes('73.02') || str.includes('73.0') || clean.includes('2 7/8') || clean.includes('2.875')) return '2-7/8 in (73.0 mm)';
  if (str.includes('60.3') || clean.includes('2 3/8') || clean.includes('2.375')) return '2-3/8 in (60.3 mm)';
  if (str.includes('114.37')) return '114.37 mm';
  if (str.includes('93.7')) return '93.7 mm';
  if (str.includes('77.8')) return '77.8 mm';

  const fracMatch = clean.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (fracMatch) {
    const whole = parseInt(fracMatch[1], 10);
    const num = parseInt(fracMatch[2], 10);
    const den = parseInt(fracMatch[3], 10);
    if (den > 0) {
      const valMm = Number(((whole + num / den) * 25.4).toFixed(1));
      return `${whole}-${num}/${den} in (${valMm} mm)`;
    }
  }

  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    if (str.includes('mm') || num > 30) return `${num} mm`;
    if (str.includes('in') || str.includes('"')) {
      const valMm = Number((num * 25.4).toFixed(1));
      return `${num} in (${valMm} mm)`;
    }
    return `${num} mm`;
  }
  return str;
}

function normalizeGrade(g: string | null | undefined): string {
  return (g || '').trim().toUpperCase();
}

function normalizeThread(t: string | null | undefined): string {
  const str = (t || '').trim().toUpperCase();
  if (str.includes('BTC') || str.includes('BUTTRESS')) return 'BTC';
  if (str.includes('LTC') || str.includes('LONG')) return 'LTC';
  if (str.includes('STC') || str.includes('SHORT')) return 'STC';
  if (str.includes('NU') || str.includes('NON-UPSET') || str.includes('NON UPSET')) return 'NU';
  if (str.includes('EUE') || str.includes('UPSET')) return 'EUE';
  if (str.includes('PREMIUM') || str.includes('GAS-TIGHT')) return 'Premium';
  return (t || '').trim();
}

function isThreadCompatible(t1: string | null | undefined, t2: string | null | undefined): boolean {
  const norm1 = normalizeThread(t1);
  const norm2 = normalizeThread(t2);
  if (!norm1 || !norm2) return true;
  if (norm1 === norm2) return true;
  // Raw unthreaded / Plain End pipe can be threaded to any finish in Stage 4 Threading
  if (norm1 === 'Plain End' || norm2 === 'Plain End' || norm1 === 'PE' || norm2 === 'PE') return true;
  // EUE and Premium are treated as compatible upset end / gas-tight connections in this catalog
  if ((norm1 === 'EUE' || norm1 === 'Premium') && (norm2 === 'EUE' || norm2 === 'Premium')) return true;
  return false;
}

export default function ShopFloorModule() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [availablePipes, setAvailablePipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [selectedWo, setSelectedWo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isWoModalOpen, setIsWoModalOpen] = useState(false);
  const [isEditWoMode, setIsEditWoMode] = useState(false);
  const [isPostingModalOpen, setIsPostingModalOpen] = useState(false);
  const [isEditPostingMode, setIsEditPostingMode] = useState(false);
  const [editingPostingId, setEditingPostingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // WO Form State
  const [woForm, setWoForm] = useState({
    wo_id: '',
    wo_date: new Date().toISOString().split('T')[0],
    customer_po_no: '',
    cpo_item_id: '',
    source_type: 'PO' as 'PO' | 'Stock',
    po_no: '',
    size: '',
    grade: '',
    thread: '',
    order_quantity: 100,
    ti_id: '',
    target_product_id: '',
    machine_line_no: 'CNC-CELL-01',
    shift: 'Shift A',
    wo_status: 'Released',
  });

  // Production Posting Form State with Defect Logging Sub-form
  const [postingForm, setPostingForm] = useState({
    pp_id: '',
    wo_id: '',
    process_stage_name: 'Cutting' as any,
    operation_seq_no: 10,
    operator_machine_id: 'CNC-CELL-01 / Op: J.Smith',
    input_quantity: 8,
    accepted_quantity: 8,
    rejected_quantity: 0,
    rework_quantity: 0,
    rejections: [
      {
        defect_category: 'Thread Flat' as any,
        defect_quantity: 1,
        disposition_action: 'Rework Thread' as any,
        inspector_remarks: '',
      },
    ],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [woRes, tallyRes, prdRes, custRes, poRes] = await Promise.all([
        fetch('/api/work-orders'),
        fetch('/api/tally?status=Available'),
        fetch('/api/products'),
        fetch('/api/customer-orders'),
        fetch('/api/purchase-orders'),
      ]);
      const [wos, tallies, prds, custs, pos] = await Promise.all([
        woRes.json(),
        tallyRes.json(),
        prdRes.json(),
        custRes.json(),
        poRes.json(),
      ]);

      if (Array.isArray(custs)) setCustomerOrders(custs);
      if (Array.isArray(pos)) setPurchaseOrders(pos);

      if (Array.isArray(wos)) {
        setWorkOrders(wos);
        setSelectedWo((prev: any) => {
          if (!prev) return wos.length > 0 ? wos[0] : null;
          const updated = wos.find((w: any) => w.wo_id === prev.wo_id);
          return updated || (wos.length > 0 ? wos[0] : null);
        });
      }

      // Collect available pipes from tally sheets
      const pipes: any[] = [];
      if (Array.isArray(tallies)) {
        tallies.forEach((ts: any) => {
          if (ts.tally_items) {
            ts.tally_items.forEach((item: any) => {
              if (item.pipe_allocation_status === 'Available') {
                pipes.push({
                  ...item,
                  heat_no: item.heat_no || ts.heat_no,
                  lot_no: item.lot_no || ts.lot_no,
                  tube_count: item.tube_count || 1,
                  po_no: ts.grn_item?.grn?.purchase_order?.po_no || ts.grn_item?.grn?.po_no,
                  product: ts.grn_item?.product,
                });
              }
            });
          }
        });
        setAvailablePipes(pipes);
      }

      if (Array.isArray(prds)) {
        setProducts(prds);
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

  // Selected Customer Order & its specifications
  const selectedCustomerOrder = customerOrders.find(
    (c) => c.customer_po_no === woForm.customer_po_no
  );
  const customerSpecs = React.useMemo(() => {
    return (
      selectedCustomerOrder?.items?.map((it: any) => ({
        size: normalizeSize(it.size),
        grade: normalizeGrade(it.grade),
        thread: normalizeThread(it.thread),
        rawSize: it.size,
        rawGrade: it.grade,
        rawThread: it.thread,
        quantity: it.quantity,
        cpo_item_id: it.cpo_item_id,
      })) || []
    );
  }, [selectedCustomerOrder]);

  // Filtered Purchase Orders:
  // - If Customer PO is selected: PO dropdown only gives POs whose line items have the SAME specification as per Customer PO
  // - If None is selected in Customer PO: PO dropdown shows ALL Open Purchase Orders
  const filteredPurchaseOrders = React.useMemo(() => {
    const openPos = purchaseOrders.filter((po) => po.po_status !== 'Closed');
    if (!woForm.customer_po_no || customerSpecs.length === 0) {
      return openPos;
    }

    return openPos.filter((po) => {
      return po.po_items?.some((pi: any) => {
        const poSize = normalizeSize(pi.product?.size_od || pi.product?.product_description);
        const poGrade = normalizeGrade(pi.product?.grade);

        return customerSpecs.some((cs: any) => {
          const sMatch = !cs.size || !poSize || cs.size === poSize || cs.size.includes(poSize) || poSize.includes(cs.size);
          const gMatch = !cs.grade || !poGrade || cs.grade === poGrade;
          // Match ONLY Size and Grade between the Purchase Order and the Customer's Order
          return sMatch && gMatch;
        });
      });
    });
  }, [purchaseOrders, woForm.customer_po_no, customerSpecs]);

  // Available Sizes for selection:
  const availableSizes = React.useMemo(() => {
    let list: string[] = [];
    if (woForm.source_type === 'PO') {
      const activePo = purchaseOrders.find((p) => p.po_no === woForm.po_no);
      if (activePo?.po_items) {
        list = activePo.po_items
          .map((pi: any) => normalizeSize(pi.product?.size_od || pi.product?.product_description))
          .filter(Boolean);
      }
    } else {
      list = products
        .map((p) => normalizeSize(p.size_od || p.product_description))
        .filter(Boolean);
    }

    if (woForm.customer_po_no && customerSpecs.length > 0) {
      const matching = list.filter((s) =>
        customerSpecs.some((cs: any) => cs.size === s || cs.size.includes(s) || s.includes(cs.size))
      );
      if (matching.length > 0) list = matching;
    }

    return Array.from(new Set(list));
  }, [woForm.source_type, woForm.po_no, woForm.customer_po_no, customerSpecs, purchaseOrders, products]);

  // Available Grades (Dependent on selected Size):
  const availableGrades = React.useMemo(() => {
    if (!woForm.size) return [];
    let list: string[] = [];

    if (woForm.source_type === 'PO') {
      const activePo = purchaseOrders.find((p) => p.po_no === woForm.po_no);
      if (activePo?.po_items) {
        list = activePo.po_items
          .filter((pi: any) => {
            const s = normalizeSize(pi.product?.size_od || pi.product?.product_description);
            return s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s);
          })
          .map((pi: any) => normalizeGrade(pi.product?.grade))
          .filter(Boolean);
      }
    } else {
      list = products
        .filter((p) => {
          const s = normalizeSize(p.size_od || p.product_description);
          return s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s);
        })
        .map((p) => normalizeGrade(p.grade))
        .filter(Boolean);
    }

    if (woForm.customer_po_no && customerSpecs.length > 0) {
      const matching = list.filter((g) =>
        customerSpecs.some((cs: any) => {
          const sMatch = !cs.size || cs.size === woForm.size || cs.size.includes(woForm.size) || woForm.size.includes(cs.size);
          return sMatch && cs.grade === g;
        })
      );
      if (matching.length > 0) list = matching;
    }

    return Array.from(new Set(list));
  }, [woForm.size, woForm.source_type, woForm.po_no, woForm.customer_po_no, customerSpecs, purchaseOrders, products]);

  // Available Threads (Dependent on selected Size & Grade):
  const availableThreads = React.useMemo(() => {
    if (!woForm.size || !woForm.grade) return [];
    let list: string[] = [];

    if (woForm.source_type === 'PO') {
      const activePo = purchaseOrders.find((p) => p.po_no === woForm.po_no);
      if (activePo?.po_items) {
        list = activePo.po_items
          .filter((pi: any) => {
            const s = normalizeSize(pi.product?.size_od || pi.product?.product_description);
            const g = normalizeGrade(pi.product?.grade);
            return (s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s)) && g === woForm.grade;
          })
          .map((pi: any) => normalizeThread(pi.product?.thread_type))
          .filter(Boolean);
      }
    } else {
      list = products
        .filter((p) => {
          const s = normalizeSize(p.size_od || p.product_description);
          const g = normalizeGrade(p.grade);
          return (s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s)) && g === woForm.grade;
        })
        .map((p) => normalizeThread(p.thread_type))
        .filter(Boolean);
    }

    if (woForm.customer_po_no && customerSpecs.length > 0) {
      const customerThreads = customerSpecs
        .filter((cs: any) => {
          const sMatch = !cs.size || cs.size === woForm.size || cs.size.includes(woForm.size) || woForm.size.includes(cs.size);
          const gMatch = !cs.grade || cs.grade === woForm.grade;
          return sMatch && gMatch;
        })
        .map((cs: any) => cs.rawThread || cs.thread)
        .filter(Boolean);

      if (customerThreads.length > 0) {
        return Array.from(new Set([...customerThreads, ...list]));
      }
    }

    return Array.from(new Set(list));
  }, [woForm.size, woForm.grade, woForm.source_type, woForm.po_no, woForm.customer_po_no, customerSpecs, purchaseOrders, products]);

  // Filtered available lots / pipes:
  // If sourcing from PO: only show dropdown of Heat/lot details associated with matching PO!
  const matchingAvailableLots = React.useMemo(() => {
    if (woForm.source_type === 'PO') {
      if (!woForm.po_no) return [];
      return availablePipes.filter((p) => {
        if (p.po_no !== woForm.po_no) return false;
        // If grade or size are selected in the form, ensure the lot matches them (if product specs exist)
        if (woForm.grade && p.product?.grade) {
          const pg = normalizeGrade(p.product.grade);
          if (pg !== woForm.grade) return false;
        }
        if (woForm.size && (p.product?.size_od || p.product?.product_description)) {
          const ps = normalizeSize(p.product.size_od || p.product.product_description);
          if (ps && ps !== woForm.size && !ps.includes(woForm.size) && !woForm.size.includes(ps)) {
            return false;
          }
        }
        return true;
      });
    }

    // Sourcing from Stock: filter by selected size/grade if specified
    return availablePipes.filter((p) => {
      const g = normalizeGrade(p.product?.grade || p.heat_grade);
      const s = normalizeSize(p.product?.size_od || p.tube_size);
      const gMatch = !woForm.grade || !g || g === woForm.grade;
      const sMatch = !woForm.size || !s || s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s);
      return gMatch && sMatch;
    });
  }, [availablePipes, woForm.source_type, woForm.po_no, woForm.grade, woForm.size]);

  // Auto-select when only 1 option is available in dependent lists
  useEffect(() => {
    if (availableSizes.length === 1 && !woForm.size) {
      setWoForm((prev) => ({ ...prev, size: availableSizes[0] }));
    }
  }, [availableSizes, woForm.size]);

  useEffect(() => {
    if (availableGrades.length === 1 && !woForm.grade) {
      setWoForm((prev) => ({ ...prev, grade: availableGrades[0] }));
    }
  }, [availableGrades, woForm.grade]);

  useEffect(() => {
    if (availableThreads.length === 1 && !woForm.thread) {
      setWoForm((prev) => ({ ...prev, thread: availableThreads[0] }));
    }
  }, [availableThreads, woForm.thread]);

  // Auto-resolve product, customer line item, and tally pipe tag
  useEffect(() => {
    if (woForm.size && woForm.grade && woForm.thread) {
      // 1. Resolve target product
      const matchedPrd = products.find((p) => {
        const s = normalizeSize(p.size_od || p.product_description);
        const g = normalizeGrade(p.grade);
        const t = normalizeThread(p.thread_type);
        return (
          (s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s)) &&
          g === woForm.grade &&
          isThreadCompatible(woForm.thread, t)
        );
      });
      if (matchedPrd && matchedPrd.product_id !== woForm.target_product_id) {
        setWoForm((prev) => ({ ...prev, target_product_id: matchedPrd.product_id }));
      }

      // 2. Resolve Customer PO item if customer PO selected (match Size and Grade)
      if (woForm.customer_po_no && selectedCustomerOrder) {
        const matchedItem = selectedCustomerOrder.items?.find((i: any) => {
          const s = normalizeSize(i.size);
          const g = normalizeGrade(i.grade);
          return (
            (s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s)) &&
            g === woForm.grade
          );
        });
        if (matchedItem) {
          setWoForm((prev) => ({
            ...prev,
            cpo_item_id: matchedItem.cpo_item_id,
            order_quantity: prev.order_quantity || matchedItem.quantity,
          }));
        }
      }

      // 3. Resolve matching available pipe in stock that associates with matching PO
      const candidatePipes = woForm.source_type === 'PO'
        ? (woForm.po_no ? availablePipes.filter((p) => p.po_no === woForm.po_no) : [])
        : availablePipes;

      const matchedPipe = candidatePipes.find((p) => {
        const g = normalizeGrade(p.product?.grade || p.heat_grade);
        const s = normalizeSize(p.product?.size_od || p.tube_size);
        return (
          (!g || g === woForm.grade) &&
          (!s || s === woForm.size || s.includes(woForm.size) || woForm.size.includes(s))
        );
      });
      if (matchedPipe) {
        if (matchedPipe.ti_id !== woForm.ti_id) {
          setWoForm((prev) => ({ ...prev, ti_id: matchedPipe.ti_id }));
        }
      } else if (woForm.ti_id && woForm.source_type === 'PO') {
        const isStillValid = candidatePipes.some((p) => p.ti_id === woForm.ti_id);
        if (!isStillValid) {
          setWoForm((prev) => ({ ...prev, ti_id: '' }));
        }
      }
    }
  }, [woForm.size, woForm.grade, woForm.thread, woForm.source_type, woForm.po_no, products, selectedCustomerOrder, availablePipes]);

  const handleOpenReleaseModal = () => {
    setIsEditWoMode(false);
    setFormError(null);
    const nextWoId = `WO-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(3, '0')}`;
    setWoForm({
      wo_id: nextWoId,
      wo_date: new Date().toISOString().split('T')[0],
      customer_po_no: '',
      cpo_item_id: '',
      source_type: 'PO',
      po_no: '',
      size: '',
      grade: '',
      thread: '',
      order_quantity: 100,
      ti_id: '',
      target_product_id: '',
      machine_line_no: 'CNC-CELL-01',
      shift: 'Shift A',
      wo_status: 'Released',
    });
    setIsWoModalOpen(true);
  };

  const handleOpenEditWO = (wo: any) => {
    setIsEditWoMode(true);
    setFormError(null);
    setWoForm({
      wo_id: wo.wo_id,
      wo_date: wo.wo_date ? new Date(wo.wo_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      customer_po_no: wo.customer_po_no || '',
      cpo_item_id: wo.cpo_item_id || '',
      source_type: (wo.source_type || (wo.po_no ? 'PO' : 'Stock')) as 'PO' | 'Stock',
      po_no: wo.po_no || '',
      size: wo.size || normalizeSize(wo.target_product?.size_od || wo.target_product?.product_description) || '',
      grade: wo.grade || normalizeGrade(wo.target_product?.grade) || '',
      thread: wo.thread || normalizeThread(wo.target_product?.thread_type) || '',
      order_quantity: wo.order_quantity || wo.planned_parts_to_produce || 100,
      ti_id: wo.ti_id || '',
      target_product_id: wo.target_product_id || '',
      machine_line_no: wo.machine_line_no || 'CNC-CELL-01',
      shift: wo.shift || 'Shift A',
      wo_status: wo.wo_status || 'Released',
    });
    setIsWoModalOpen(true);
  };

  const handleDeleteWO = async (woId: string) => {
    if (!window.confirm(`Are you sure you want to delete Work Order ${woId}?\nThis will permanently delete this job card, its routing logs, and free any allocated raw material pipe.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/work-orders?wo_id=${encodeURIComponent(woId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete Work Order');
      alert(`Work Order ${woId} deleted successfully.`);
      if (selectedWo?.wo_id === woId) {
        setSelectedWo(null);
      }
      fetchData();
    } catch (err: any) {
      alert(`Error deleting Work Order: ${err.message}`);
    }
  };

  const handleCreateWO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (woForm.source_type === 'PO' && !woForm.po_no) {
        throw new Error('Please select a Raw Material PO (RM PO) No.');
      }
      if (!woForm.size) throw new Error('Please select Size.');
      if (!woForm.grade) throw new Error('Please select Grade.');
      if (!woForm.thread) throw new Error('Please select Thread.');
      if (!woForm.order_quantity || Number(woForm.order_quantity) <= 0) {
        throw new Error('Quantity must be greater than 0.');
      }

      const payload = {
        ...woForm,
        order_quantity: Number(woForm.order_quantity),
        planned_parts_to_produce: Number(woForm.order_quantity),
        po_no: woForm.source_type === 'PO' ? woForm.po_no : null,
        customer_po_no: woForm.customer_po_no || null,
        cpo_item_id: woForm.cpo_item_id || null,
        ti_id: woForm.ti_id || null,
      };

      const res = await fetch('/api/work-orders', {
        method: isEditWoMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditWoMode ? 'update' : 'release'} Work Order`);

      setIsWoModalOpen(false);
      fetchData();
      if (isEditWoMode && selectedWo?.wo_id === woForm.wo_id) {
        setSelectedWo(data);
      }
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Live balance check for production postings
  const balanceCheck = validateProductionBalance(
    postingForm.input_quantity,
    postingForm.accepted_quantity,
    postingForm.rejected_quantity,
    postingForm.rework_quantity
  );

  // Work Order Target Quantity to Produce (User Entry)
  const woTargetQty = selectedWo?.planned_parts_to_produce || selectedWo?.order_quantity || 0;

  // Existing postings for current modal stage (exclude currently edited posting if in edit mode)
  const existingStagePostings = (selectedWo?.production_postings || []).filter(
    (p: any) => p.operation_seq_no === postingForm.operation_seq_no && (!isEditPostingMode || p.pp_id !== editingPostingId)
  );
  const existingStageAcc = existingStagePostings.reduce(
    (sum: number, p: any) => sum + (p.accepted_quantity || 0),
    0
  );
  const existingStageRej = existingStagePostings.reduce(
    (sum: number, p: any) => sum + (p.rejected_quantity || 0),
    0
  );

  // Live reconciliation check for Work Order Quantity to Produce Gate
  const woQuantityGate = validateWorkOrderStageQuantityLimit(
    woTargetQty,
    existingStageAcc,
    existingStageRej,
    postingForm.accepted_quantity,
    postingForm.rejected_quantity,
    postingForm.process_stage_name,
    postingForm.operation_seq_no
  );

  // Generate a clean, unique posting ID based on WO and Stage sequence
  const generatePostingId = (woId: string, seq: number, postings: any[] = []) => {
    const baseId = `PP-${woId}-OP${seq}`;
    const existing = postings.filter(
      (p: any) => p.operation_seq_no === seq || (p.pp_id && p.pp_id.startsWith(baseId))
    );
    if (existing.length === 0) {
      return baseId;
    }
    return `${baseId}-R${existing.length + 1}`;
  };

  const handleOpenPostingModal = (targetStage?: any) => {
    if (!selectedWo) return;
    setFormError(null);
    setIsEditPostingMode(false);
    setEditingPostingId(null);

    const existingPostings = selectedWo.production_postings || [];

    // Find target stage: passed stage OR first uncompleted stage OR default to first stage
    let stageToLog = targetStage;
    if (!stageToLog) {
      const nextPending = PROCESS_STAGES.find(
        (s) => !existingPostings.some((p: any) => p.operation_seq_no === s.seq)
      );
      stageToLog = nextPending || PROCESS_STAGES[0];
    }

    const woQty = selectedWo.planned_parts_to_produce || selectedWo.order_quantity || 100;
    const stagePostings = existingPostings.filter((p: any) => p.operation_seq_no === stageToLog.seq);
    const priorStageQty = stagePostings.reduce(
      (sum: number, p: any) => sum + (p.accepted_quantity || 0) + (p.rejected_quantity || 0),
      0
    );
    const maxRemaining = Math.max(0, woQty - priorStageQty);

    // Determine input quantity from previous stage's accepted_quantity (or planned parts if OP 10)
    let initialQty = woQty;
    if (stageToLog.seq > 10) {
      const completedPreviousStages = existingPostings
        .filter((p: any) => p.operation_seq_no < stageToLog.seq)
        .sort((a: any, b: any) => b.operation_seq_no - a.operation_seq_no);

      if (completedPreviousStages.length > 0) {
        initialQty = completedPreviousStages[0].accepted_quantity;
      }
    }
    initialQty = Math.min(initialQty, maxRemaining);

    const nextPpId = generatePostingId(selectedWo.wo_id, stageToLog.seq, existingPostings);

    setPostingForm({
      pp_id: nextPpId,
      wo_id: selectedWo.wo_id,
      process_stage_name: stageToLog.name,
      operation_seq_no: stageToLog.seq,
      operator_machine_id: `${selectedWo.machine_line_no || 'CNC-CELL-01'} / Op: Lead`,
      input_quantity: initialQty,
      accepted_quantity: initialQty,
      rejected_quantity: 0,
      rework_quantity: 0,
      rejections: [
        {
          defect_category: 'Thread Flat',
          defect_quantity: 1,
          disposition_action: 'Rework Thread',
          inspector_remarks: '',
        },
      ],
    });
    setIsPostingModalOpen(true);
  };

  const handleOpenEditPosting = (posting: any) => {
    if (!selectedWo || !posting) return;
    setFormError(null);
    setIsEditPostingMode(true);
    setEditingPostingId(posting.pp_id);

    setPostingForm({
      pp_id: posting.pp_id,
      wo_id: selectedWo.wo_id,
      process_stage_name: posting.process_stage_name,
      operation_seq_no: posting.operation_seq_no,
      operator_machine_id: posting.operator_machine_id || `${selectedWo.machine_line_no || 'CNC-CELL-01'} / Op: Lead`,
      input_quantity: posting.input_quantity,
      accepted_quantity: posting.accepted_quantity,
      rejected_quantity: posting.rejected_quantity,
      rework_quantity: posting.rework_quantity,
      rejections: posting.rejections && posting.rejections.length > 0
        ? posting.rejections.map((r: any) => ({
            defect_category: r.defect_category,
            defect_quantity: r.defect_quantity,
            disposition_action: r.disposition_action,
            inspector_remarks: r.inspector_remarks || '',
          }))
        : [
            {
              defect_category: 'Thread Flat',
              defect_quantity: posting.rejected_quantity || 1,
              disposition_action: 'Rework Thread',
              inspector_remarks: '',
            },
          ],
    });
    setIsPostingModalOpen(true);
  };

  const handleDeletePosting = async (ppId: string) => {
    if (!confirm(`Are you sure you want to delete routing posting ${ppId}?`)) return;
    try {
      const res = await fetch(`/api/production-postings?pp_id=${encodeURIComponent(ppId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete posting');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStageSelect = (stageName: any, seq: number) => {
    if (!selectedWo) return;
    const existingPostings = selectedWo.production_postings || [];
    const woQty = selectedWo.planned_parts_to_produce || selectedWo.order_quantity || 100;
    const stagePostings = existingPostings.filter((p: any) => p.operation_seq_no === seq && (!isEditPostingMode || p.pp_id !== editingPostingId));
    const priorStageQty = stagePostings.reduce(
      (sum: number, p: any) => sum + (p.accepted_quantity || 0) + (p.rejected_quantity || 0),
      0
    );
    const maxRemaining = Math.max(0, woQty - priorStageQty);

    let initialQty = woQty;
    if (seq > 10) {
      const completedPreviousStages = existingPostings
        .filter((p: any) => p.operation_seq_no < seq)
        .sort((a: any, b: any) => b.operation_seq_no - a.operation_seq_no);
      if (completedPreviousStages.length > 0) {
        initialQty = completedPreviousStages[0].accepted_quantity;
      }
    }
    initialQty = Math.min(initialQty, maxRemaining);

    const newPpId = isEditPostingMode && editingPostingId ? editingPostingId : generatePostingId(selectedWo.wo_id, seq, existingPostings);

    setPostingForm((prev) => {
      const inp = isEditPostingMode ? prev.input_quantity : initialQty;
      const rej = isEditPostingMode ? prev.rejected_quantity : 0;
      const rew = isEditPostingMode ? prev.rework_quantity : 0;
      const acc = isEditPostingMode ? prev.accepted_quantity : Math.max(0, inp - rej - rew);
      return {
        ...prev,
        pp_id: newPpId,
        process_stage_name: stageName,
        operation_seq_no: seq,
        input_quantity: inp,
        accepted_quantity: acc,
        rejected_quantity: rej,
        rework_quantity: rew,
      };
    });
  };

  // Handler for Input Qty change: automatically calculates Accepted Qty = Input Qty - Rejected Qty
  const handlePostingInputQtyChange = (newVal: number) => {
    const inputQty = Math.max(0, newVal);
    const rejQty = postingForm.rejected_quantity;
    const rewQty = postingForm.rework_quantity;
    const accQty = Math.max(0, inputQty - rejQty - rewQty);
    setPostingForm((prev) => ({
      ...prev,
      input_quantity: inputQty,
      accepted_quantity: accQty,
    }));
  };

  // Handler for Rejected Qty change: automatically calculates Accepted Qty = Input Qty - Rejected Qty
  const handlePostingRejectedQtyChange = (newVal: number) => {
    const rejQty = Math.max(0, newVal);
    const inputQty = postingForm.input_quantity;
    const rewQty = postingForm.rework_quantity;
    const accQty = Math.max(0, inputQty - rejQty - rewQty);

    const updatedRejections = rejQty > 0
      ? (postingForm.rejections && postingForm.rejections.length > 0
          ? postingForm.rejections.map((r, idx) => (idx === 0 ? { ...r, defect_quantity: rejQty } : r))
          : [
              {
                defect_category: 'Thread Flat',
                defect_quantity: rejQty,
                disposition_action: 'Rework Thread',
                inspector_remarks: '',
              },
            ])
      : [];

    setPostingForm((prev) => ({
      ...prev,
      rejected_quantity: rejQty,
      accepted_quantity: accQty,
      rejections: updatedRejections,
    }));
  };

  // Handler for Accepted Qty change: automatically balances Rejected Qty = Input Qty - Accepted Qty
  const handlePostingAcceptedQtyChange = (newVal: number) => {
    const accQty = Math.max(0, newVal);
    const inputQty = postingForm.input_quantity;
    const rewQty = postingForm.rework_quantity;
    const rejQty = Math.max(0, inputQty - accQty - rewQty);

    const updatedRejections = rejQty > 0
      ? (postingForm.rejections && postingForm.rejections.length > 0
          ? postingForm.rejections.map((r, idx) => (idx === 0 ? { ...r, defect_quantity: rejQty } : r))
          : [
              {
                defect_category: 'Thread Flat',
                defect_quantity: rejQty,
                disposition_action: 'Rework Thread',
                inspector_remarks: '',
              },
            ])
      : [];

    setPostingForm((prev) => ({
      ...prev,
      accepted_quantity: accQty,
      rejected_quantity: rejQty,
      rejections: updatedRejections,
    }));
  };

  // Handler for Rework Qty change: balances Accepted Qty = Input Qty - Rejected Qty - Rework Qty
  const handlePostingReworkQtyChange = (newVal: number) => {
    const rewQty = Math.max(0, newVal);
    const inputQty = postingForm.input_quantity;
    const rejQty = postingForm.rejected_quantity;
    const accQty = Math.max(0, inputQty - rejQty - rewQty);
    setPostingForm((prev) => ({
      ...prev,
      rework_quantity: rewQty,
      accepted_quantity: accQty,
    }));
  };

  const handleCreatePosting = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (!balanceCheck.isBalanced) {
        throw new Error(balanceCheck.errorMessage);
      }
      if (woQuantityGate.isExceeded) {
        throw new Error(woQuantityGate.errorMessage || 'Sum of Accepted and Rejected quantities exceeds Work Order Quantity to Produce');
      }

      const payload = {
        ...postingForm,
        rejections: postingForm.rejected_quantity > 0 ? postingForm.rejections : [],
      };

      const method = isEditPostingMode ? 'PUT' : 'POST';
      const res = await fetch('/api/production-postings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditPostingMode ? 'update' : 'log'} production posting`);

      setIsPostingModalOpen(false);
      setIsEditPostingMode(false);
      setEditingPostingId(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Find selected pipe for WO preview
  const currentSelectedPipe = availablePipes.find((p) => p.ti_id === woForm.ti_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Shop Floor & Work Order Execution</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Release job cards from available pipes and track the 8-stage manufacturing routing with live quantity balance gates.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenReleaseModal}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Release Work Order</span>
          </button>
        </div>
      </div>

      {/* Main Layout: WO Selector & Routing Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Work Order Cards */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center justify-between px-1">
            <span>Work Orders ({workOrders.length})</span>
            <span className="text-[10px] text-slate-500">Select to inspect routing</span>
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {workOrders.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-xs">
                No active work orders.
              </div>
            ) : (
              workOrders.map((wo) => {
                const isSelected = selectedWo?.wo_id === wo.wo_id;
                const completedStages = wo.production_postings?.length || 0;
                return (
                  <div
                    key={wo.wo_id}
                    onClick={() => setSelectedWo(wo)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-850 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-blue-400">{wo.wo_id}</span>
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            wo.wo_status === 'Completed'
                              ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                              : wo.wo_status === 'In Progress'
                              ? 'bg-blue-950 border border-blue-800 text-blue-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {wo.wo_status}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditWO(wo);
                          }}
                          title="Edit Work Order"
                          className="p-1 rounded hover:bg-blue-950 text-slate-400 hover:text-blue-300 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWO(wo.wo_id);
                          }}
                          title="Delete Work Order"
                          className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-300">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" />
                        <span>{wo.machine_line_no}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">{wo.shift}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 font-mono text-[11px]">{formatDate(wo.wo_date)}</span>
                      </div>
                      {/* Source, Specs, and Qty Badge */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {wo.source_type === 'Stock' ? '📦 Stock' : `🛒 ${wo.po_no || 'RM PO'}`}
                        </span>
                        {(wo.size || wo.grade || wo.target_product?.grade) && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/50 font-mono">
                            {wo.size || `${wo.target_product?.size_od || ''}mm`} • {wo.grade || wo.target_product?.grade} {wo.thread || wo.target_product?.thread_type}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono font-bold">
                          {wo.order_quantity || wo.planned_parts_to_produce} Pcs
                        </span>
                      </div>

                      {wo.ti_id && (
                        <div className="text-[11px] text-slate-500 mt-1 font-mono">
                          Pipe Tag: <span className="text-slate-300">{wo.ti_id}</span>
                        </div>
                      )}
                      {wo.customer_po_no && (
                        <div className="text-[11px] text-blue-300 mt-1 font-mono flex items-center space-x-1">
                          <span className="text-slate-500">Cust PO:</span>
                          <span className="font-bold text-blue-400">{wo.customer_po_no}</span>
                          {wo.customer_order?.customer_name && (
                            <span className="text-slate-400 font-sans truncate max-w-[120px]">
                              ({wo.customer_order.customer_name})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar for 8 Stages */}
                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Routing Progress</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {completedStages} / 8 Stages
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${(completedStages / 8) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: 8-Stage Routing Flow Visualizer */}
        <div className="lg:col-span-8 space-y-4">
          {selectedWo ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
              {/* Selected WO Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold font-mono text-white">{selectedWo.wo_id}</span>
                    <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                      Target: {selectedWo.target_product?.grade} {selectedWo.target_product?.thread_type}
                    </span>
                    <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                      Date: {formatDate(selectedWo.wo_date)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Planned Parts to Produce: <span className="font-mono font-bold text-emerald-400">{selectedWo.planned_parts_to_produce} pcs</span> from Pipe Tag{' '}
                    <span className="font-mono text-amber-300">{selectedWo.ti_id}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenEditWO(selectedWo)}
                    className="inline-flex items-center space-x-1 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                    title="Edit Work Order"
                  >
                    <Pencil className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit WO</span>
                  </button>
                  <button
                    onClick={() => handleDeleteWO(selectedWo.wo_id)}
                    className="inline-flex items-center space-x-1 px-2.5 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/50 transition-colors"
                    title="Delete Work Order"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={() => handleOpenPostingModal()}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Log Production Stage</span>
                  </button>
                </div>
              </div>

              {/* 8 Process Stages Visual Pipeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase font-bold text-slate-400 block">
                    8-Stage Manufacturing Routing Operations
                  </span>
                  <span className="text-[11px] text-slate-500">
                    💡 Click any stage card to log or record run
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {PROCESS_STAGES.map((stage) => {
                    const stagePostings = selectedWo.production_postings?.filter(
                      (p: any) => p.operation_seq_no === stage.seq
                    ) || [];
                    const isCompleted = stagePostings.length > 0;
                    const stageInput = stagePostings.reduce((sum: number, p: any) => sum + (p.input_quantity || 0), 0);
                    const stageAcc = stagePostings.reduce((sum: number, p: any) => sum + (p.accepted_quantity || 0), 0);
                    const stageRej = stagePostings.reduce((sum: number, p: any) => sum + (p.rejected_quantity || 0), 0);
                    const stageRew = stagePostings.reduce((sum: number, p: any) => sum + (p.rework_quantity || 0), 0);
                    const hasRejection = stageRej > 0;
                    const woPlanned = selectedWo.planned_parts_to_produce || selectedWo.order_quantity || 100;
                    const isFullyCompleted = stageAcc + stageRej >= woPlanned;

                    return (
                      <div
                        key={stage.seq}
                        onClick={() => handleOpenPostingModal(stage)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 group ${
                          isCompleted
                            ? isFullyCompleted
                              ? hasRejection
                                ? 'bg-amber-950/20 border-amber-800/60'
                                : 'bg-emerald-950/20 border-emerald-800/60'
                              : 'bg-blue-950/20 border-blue-800/50'
                            : 'bg-slate-950/80 border-slate-800 hover:opacity-100 opacity-75'
                        }`}
                        title={`Click to log or view OP ${stage.seq}: ${stage.name}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-blue-300">
                            OP {stage.seq} {stagePostings.length > 1 ? `(${stagePostings.length} runs)` : ''}
                          </span>
                          <div className="flex items-center space-x-1">
                            {isCompleted && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditPosting(stagePostings[stagePostings.length - 1]);
                                }}
                                title={`Edit OP ${stage.seq}: ${stage.name}`}
                                className="p-1 rounded hover:bg-blue-900/60 text-slate-400 hover:text-blue-300 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {isCompleted ? (
                              <CheckCircle2
                                className={`w-4 h-4 ${hasRejection ? 'text-amber-400' : isFullyCompleted ? 'text-emerald-400' : 'text-blue-400'}`}
                              />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400" />
                            )}
                          </div>
                        </div>

                        <div className="font-semibold text-xs text-white group-hover:text-blue-200 transition-colors">{stage.name}</div>
                        <div className="text-[10px] text-slate-500 truncate mb-2">{stage.description}</div>

                        {isCompleted ? (
                          <div className="pt-2 border-t border-slate-800/80 font-mono text-[10px] space-y-1">
                            <div className="flex justify-between text-slate-400">
                              <span>In: {stageInput}</span>
                              <span className="text-emerald-400 font-bold">Acc: {stageAcc}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span className={stageRej > 0 ? 'text-rose-400 font-bold' : ''}>
                                Rej: {stageRej}
                              </span>
                              <span>Rew: {stageRew}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500 pt-0.5">
                              <span>Total: {stageAcc + stageRej}/{woPlanned}</span>
                              <span className={isFullyCompleted ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                                {isFullyCompleted ? '✓ Done' : `${woPlanned - (stageAcc + stageRej)} left`}
                              </span>
                            </div>

                            {/* Multiple runs breakdown with individual edit options */}
                            {stagePostings.length > 1 && (
                              <div className="pt-1 flex flex-wrap gap-1">
                                {stagePostings.map((p: any, idx: number) => (
                                  <button
                                    key={p.pp_id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditPosting(p);
                                    }}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 flex items-center space-x-1 transition-colors"
                                    title={`Edit Run ${idx + 1}: ${p.pp_id}`}
                                  >
                                    <span>Run {idx + 1} ({p.accepted_quantity})</span>
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Card action footer */}
                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditPosting(stagePostings[stagePostings.length - 1]);
                                }}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-950/70 hover:bg-blue-900 text-blue-300 border border-blue-800/60 font-medium transition-colors"
                                title="Edit this stage posting"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit {stagePostings.length > 1 ? 'Last Run' : 'Stage'}</span>
                              </button>
                              {!isFullyCompleted && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPostingModal(stage);
                                  }}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 font-medium transition-colors"
                                  title="Log another run for this stage"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>+ Run</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-blue-400/80 group-hover:text-blue-300 flex items-center justify-between">
                            <span>Pending</span>
                            <span className="text-[9px] underline">Click to log &rarr;</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Logged Routing Operations Table with Direct Edit and Delete */}
              {selectedWo.production_postings?.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase font-bold text-blue-400 flex items-center space-x-1.5">
                      <Layers className="w-4 h-4" />
                      <span>Logged Routing Operations ({selectedWo.production_postings.length} Postings)</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ✏️ Click Edit on any row to modify quantities, defect reasons or machine
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 text-[11px]">
                        <tr>
                          <th className="px-3 py-2">Stage</th>
                          <th className="px-3 py-2">Posting ID</th>
                          <th className="px-3 py-2 text-right">Input</th>
                          <th className="px-3 py-2 text-right text-emerald-400">Accepted</th>
                          <th className="px-3 py-2 text-right text-rose-400">Rejected</th>
                          <th className="px-3 py-2 text-right text-amber-400">Rework</th>
                          <th className="px-3 py-2">Station / Operator</th>
                          <th className="px-3 py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {selectedWo.production_postings.map((p: any) => (
                          <tr key={p.pp_id} className="hover:bg-slate-850/40 transition-colors">
                            <td className="px-3 py-2 font-bold text-slate-200">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300">
                                OP {p.operation_seq_no}: {p.process_stage_name}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-blue-400 font-bold">
                              <div>{p.pp_id}</div>
                              <div className="text-[10px] text-slate-500 font-normal">{formatDateTime(p.stage_completion_timestamp)}</div>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-300 font-bold">{p.input_quantity}</td>
                            <td className="px-3 py-2 text-right text-emerald-400 font-bold">{p.accepted_quantity}</td>
                            <td className="px-3 py-2 text-right font-bold">
                              <span className={p.rejected_quantity > 0 ? 'text-rose-400' : 'text-slate-500'}>
                                {p.rejected_quantity}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-amber-400 font-bold">{p.rework_quantity}</td>
                            <td className="px-3 py-2 text-slate-400 text-[11px] truncate max-w-[180px]">
                              {p.operator_machine_id}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPosting(p)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-950 hover:bg-blue-900 border border-blue-800 text-blue-300 text-[11px] font-semibold transition-colors shadow-sm"
                                  title={`Edit ${p.pp_id}`}
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePosting(p.pp_id)}
                                  className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors"
                                  title={`Delete ${p.pp_id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Defect Logs for this Work Order */}
              {selectedWo.rejection_postings?.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <span className="text-xs font-mono uppercase font-bold text-rose-400 flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Defects Logged For This Job Card ({selectedWo.rejection_postings.length})</span>
                  </span>

                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 text-[11px]">
                        <tr>
                          <th className="px-3 py-2">Defect ID</th>
                          <th className="px-3 py-2">Defect Category</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Disposition</th>
                          <th className="px-3 py-2">Inspector Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {selectedWo.rejection_postings.map((r: any) => (
                          <tr key={r.rp_id} className="hover:bg-slate-850/40">
                            <td className="px-3 py-2 text-rose-400">{r.rp_id}</td>
                            <td className="px-3 py-2 font-bold text-slate-200">{r.defect_category}</td>
                            <td className="px-3 py-2 text-rose-400 font-bold">{r.defect_quantity} pcs</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  r.disposition_action === 'Scrap'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                                }`}
                              >
                                {r.disposition_action}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-sans text-slate-400 text-[11px]">{r.inspector_remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
              Select a work order from the left to inspect routing.
            </div>
          )}
        </div>
      </div>

      {/* Release Work Order Modal */}
      {isWoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {isEditWoMode ? `Edit Work Order Job Card (${woForm.wo_id})` : 'Release Work Order Job Card'}
                </h3>
              </div>
              <button onClick={() => setIsWoModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateWO} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Header: WO ID, Date, and Status (when editing) */}
              <div className={`grid gap-3 ${isEditWoMode ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div>
                  <label className="block text-slate-400 mb-1">Work Order ID *</label>
                  <input
                    type="text"
                    value={woForm.wo_id}
                    onChange={(e) => setWoForm({ ...woForm, wo_id: e.target.value })}
                    disabled={isEditWoMode}
                    required
                    className={`w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500 ${
                      isEditWoMode ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''
                    }`}
                  />
                  {isEditWoMode && (
                    <span className="text-[10px] text-slate-500 font-mono">Locked</span>
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Work Order Date *</label>
                  <input
                    type="date"
                    value={woForm.wo_date}
                    onChange={(e) => setWoForm({ ...woForm, wo_date: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 font-mono focus:border-blue-500"
                  />
                </div>
                {isEditWoMode && (
                  <div>
                    <label className="block text-slate-400 mb-1">Status</label>
                    <select
                      value={woForm.wo_status}
                      onChange={(e) => setWoForm({ ...woForm, wo_status: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-xs font-mono focus:border-blue-500"
                    >
                      <option value="Released">Released</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Closed">Closed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Step 1: Customer's PO (that could be none also) */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-900/60 text-blue-400 flex items-center justify-center text-[10px] font-mono font-bold">1</span>
                    <span>Customer&apos;s PO No. (Demand Allocation)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Optional • None for Stock</span>
                </div>
                <select
                  value={woForm.customer_po_no}
                  onChange={(e) => {
                    const poNo = e.target.value;
                    const cOrder = customerOrders.find((c) => c.customer_po_no === poNo);
                    const firstItm = cOrder?.items?.[0];
                    setWoForm((prev) => ({
                      ...prev,
                      customer_po_no: poNo,
                      cpo_item_id: firstItm?.cpo_item_id || '',
                      po_no: '',
                      size: '',
                      grade: '',
                      thread: '',
                      order_quantity: firstItm ? Number(firstItm.quantity) : prev.order_quantity,
                    }));
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:border-blue-500"
                >
                  <option value="">-- None (Internal / Make-to-Stock / Unassigned) --</option>
                  {customerOrders.map((co) => (
                    <option key={co.customer_po_no} value={co.customer_po_no}>
                      {co.customer_po_no} • {co.customer_name} ({co.items?.length || 0} specs)
                    </option>
                  ))}
                </select>

                {/* Customer PO Spec Preview if selected */}
                {selectedCustomerOrder && customerSpecs.length > 0 && (
                  <div className="p-2.5 bg-blue-950/30 border border-blue-900/40 rounded-lg space-y-1 text-[11px]">
                    <div className="text-blue-300 font-medium flex items-center justify-between">
                      <span>Customer PO Specifications:</span>
                      <span className="text-slate-400 font-mono">{selectedCustomerOrder.customer_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customerSpecs.map((cs: any, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700/60 text-blue-200 font-mono text-[10px]">
                          #{idx + 1}: {cs.size} • {cs.grade} {cs.thread} ({cs.quantity} pcs)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Material Sourcing: Purchase Order PO No. OR Stock (Inventory) */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-900/60 text-blue-400 flex items-center justify-center text-[10px] font-mono font-bold">2</span>
                    <span>Material Sourcing: Raw Material PO (RM PO) No. or Stock (Inventory)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Source Type</span>
                </div>

                {/* Toggle between Purchase Order and Stock */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setWoForm((prev) => ({ ...prev, source_type: 'PO', size: '', grade: '', thread: '' }));
                    }}
                    className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                      woForm.source_type === 'PO'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Raw Material PO (RM PO)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWoForm((prev) => ({ ...prev, source_type: 'Stock', po_no: '', size: '', grade: '', thread: '' }));
                    }}
                    className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                      woForm.source_type === 'Stock'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Stock (Inventory)</span>
                  </button>
                </div>

                {/* If Purchase Order is selected */}
                {woForm.source_type === 'PO' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Raw Material PO (RM PO) No.</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {woForm.customer_po_no ? 'Filtered by Customer PO Size & Grade' : 'All Open RM POs'}
                      </span>
                    </div>
                    <select
                      value={woForm.po_no}
                      onChange={(e) => {
                        const poNo = e.target.value;
                        setWoForm((prev) => ({
                          ...prev,
                          po_no: poNo,
                          size: '',
                          grade: '',
                          thread: '',
                          ti_id: '',
                        }));
                      }}
                      required={woForm.source_type === 'PO'}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:border-blue-500"
                    >
                      <option value="">-- Select Raw Material PO (RM PO) No. --</option>
                      {filteredPurchaseOrders.map((po) => {
                        const poSpecs = po.po_items
                          ?.map(
                            (pi: any) =>
                              `${normalizeSize(pi.product?.size_od || pi.product?.product_description)} ${normalizeGrade(
                                pi.product?.grade
                              )} ${normalizeThread(pi.product?.thread_type)}`
                          )
                          .join(', ');
                        return (
                          <option key={po.po_no} value={po.po_no}>
                            {po.po_no} • {po.supplier?.supplier_name} {poSpecs ? `(${poSpecs})` : ''} [{po.po_status}]
                          </option>
                        );
                      })}
                    </select>

                    {filteredPurchaseOrders.length === 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[11px]">
                        ⚠️ No Raw Material Purchase Orders (RM PO) match the Size and Grade specifications of <strong>{woForm.customer_po_no}</strong>. You can switch to <strong>Stock (Inventory)</strong> above to fulfill from existing warehouse stock.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-300 flex items-center space-x-2">
                    <Boxes className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Allocating raw material directly from free warehouse stock &amp; available pipe inventory.</span>
                  </div>
                )}
              </div>

              {/* Step 3: Dependent Dropdowns of Size, Grade, and Thread */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-900/60 text-blue-400 flex items-center justify-center text-[10px] font-mono font-bold">3</span>
                    <span>Dependent Product Specifications</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Size → Grade → Thread</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Size Dropdown */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Size *</label>
                    <select
                      value={woForm.size}
                      onChange={(e) => {
                        const newSize = e.target.value;
                        setWoForm((prev) => ({
                          ...prev,
                          size: newSize,
                          grade: '',
                          thread: '',
                        }));
                      }}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono text-xs focus:border-blue-500"
                    >
                      <option value="">-- Select Size --</option>
                      {availableSizes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Grade Dropdown (Dependent on selected Size) */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Grade *</label>
                    <select
                      value={woForm.grade}
                      onChange={(e) => {
                        const newGrade = e.target.value;
                        setWoForm((prev) => ({
                          ...prev,
                          grade: newGrade,
                          thread: '',
                        }));
                      }}
                      disabled={!woForm.size}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono text-xs focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">{woForm.size ? '-- Select Grade --' : '-- Size First --'}</option>
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Thread Dropdown (Dependent on selected Size & Grade) */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Thread *</label>
                    <select
                      value={woForm.thread}
                      onChange={(e) => {
                        const newThread = e.target.value;
                        setWoForm((prev) => ({
                          ...prev,
                          thread: newThread,
                        }));
                      }}
                      disabled={!woForm.grade}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono text-xs focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">{woForm.grade ? '-- Select Thread --' : '-- Grade First --'}</option>
                      {availableThreads.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 4: Qty (User Entry) */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-900/60 text-blue-400 flex items-center justify-center text-[10px] font-mono font-bold">4</span>
                    <span>Quantity to Produce (User Entry) *</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">In Pieces (Pcs)</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 100"
                    value={woForm.order_quantity}
                    onChange={(e) =>
                      setWoForm({ ...woForm, order_quantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-sm font-bold focus:border-blue-500 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    Pcs
                  </span>
                </div>
                {woForm.customer_po_no && (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Customer Order Reference:</span>
                    <span className="font-mono text-blue-300">{woForm.customer_po_no}</span>
                  </div>
                )}
              </div>

              {/* Matched Available Lot / Pipe Tag in Stock (Optional) - Filtered to matching PO */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold text-xs">
                    Matched Available Lot / Pipe Tag in Stock (Optional)
                  </label>
                  {woForm.source_type === 'PO' && woForm.po_no && (
                    <span className="text-[10px] text-blue-400 font-mono">
                      RM PO: {woForm.po_no} ({matchingAvailableLots.length} lot{matchingAvailableLots.length !== 1 ? 's' : ''} available)
                    </span>
                  )}
                </div>
                <select
                  value={woForm.ti_id}
                  onChange={(e) => setWoForm({ ...woForm, ti_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-amber-400 font-mono text-xs focus:border-amber-500"
                >
                  <option value="">
                    {woForm.source_type === 'PO' && !woForm.po_no
                      ? '-- Select Raw Material PO (RM PO) No. First --'
                      : matchingAvailableLots.length === 0
                      ? (woForm.source_type === 'PO' ? `-- No Inwarded Lots Found for RM PO ${woForm.po_no} --` : '-- No Matching Lots in Stock --')
                      : '-- Auto / None (Assign On Shop Floor) --'}
                  </option>
                  {woForm.ti_id && !matchingAvailableLots.some((p) => p.ti_id === woForm.ti_id) && (
                    <option value={woForm.ti_id}>
                      {woForm.ti_id} (Currently Allocated to this Work Order)
                    </option>
                  )}
                  {matchingAvailableLots.map((p) => (
                    <option key={p.ti_id} value={p.ti_id}>
                      Heat: {p.heat_no || 'N/A'} • Lot: {p.lot_no || 'N/A'} • Tag: {p.ti_id} ({p.tube_count ? `${p.tube_count} tubes, ` : ''}{p.tube_length_mm}mm • {p.rounded_qty} Parts)
                    </option>
                  ))}
                </select>
                {woForm.source_type === 'PO' && woForm.po_no && matchingAvailableLots.length > 0 && (
                  <div className="mt-1 text-[10px] text-emerald-400 font-mono">
                    ✓ Showing only Heat/Lot inwardings associated with matching RM PO ({woForm.po_no})
                  </div>
                )}
                {woForm.source_type === 'PO' && woForm.po_no && matchingAvailableLots.length === 0 && (
                  <div className="mt-1 text-[10px] text-slate-500">
                    ℹ️ No dimensional tally lots inwarded yet for RM PO {woForm.po_no}. You can still release this Work Order and assign lots once inwarded.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsWoModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 transition-all text-xs"
                >
                  {isEditWoMode ? 'Save Changes' : 'Release Job Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Production Posting Modal with Strict Balance Gate Check */}
      {isPostingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  {isEditPostingMode ? <Pencil className="w-4 h-4 text-blue-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                  <span>
                    {isEditPostingMode
                      ? `Edit Routing Stage (${postingForm.process_stage_name} • OP ${postingForm.operation_seq_no})`
                      : 'Log Routing Stage Completion'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isEditPostingMode
                    ? 'Modify quantities, defect classifications or station assignments'
                    : 'Strict Quantity Balance Gate Enforced'}
                </p>
              </div>
              <button onClick={() => setIsPostingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePosting} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">Posting ID</label>
                    {isEditPostingMode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/80 font-mono">
                        Locked ID
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={postingForm.pp_id}
                    readOnly={isEditPostingMode}
                    onChange={(e) => setPostingForm({ ...postingForm, pp_id: e.target.value })}
                    required
                    className={`w-full border rounded px-3 py-1.5 text-slate-200 font-mono ${
                      isEditPostingMode
                        ? 'bg-slate-900 border-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Process Stage</label>
                  <select
                    value={postingForm.process_stage_name}
                    disabled={isEditPostingMode}
                    onChange={(e) => {
                      const stage = PROCESS_STAGES.find((s) => s.name === e.target.value);
                      if (stage) handleStageSelect(stage.name, stage.seq);
                    }}
                    className={`w-full border rounded px-3 py-1.5 text-slate-200 font-semibold ${
                      isEditPostingMode
                        ? 'bg-slate-900 border-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {PROCESS_STAGES.map((s) => (
                      <option key={s.seq} value={s.name}>
                        OP {s.seq}: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Operator & Machine Station</label>
                <input
                  type="text"
                  value={postingForm.operator_machine_id}
                  onChange={(e) => setPostingForm({ ...postingForm, operator_machine_id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 font-mono"
                />
              </div>

              {/* Quantity Balance Gate Box */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <Scale className="w-4 h-4 text-blue-400" />
                    <span>Production Quantity Balance Gate</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      balanceCheck.isBalanced
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                    }`}
                  >
                    {balanceCheck.isBalanced
                      ? `✔ Equation Balanced: ${postingForm.input_quantity} - ${postingForm.rejected_quantity} = ${postingForm.accepted_quantity}`
                      : `Violation: Delta ${balanceCheck.delta > 0 ? '+' : ''}${balanceCheck.delta}`}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 font-mono">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Input Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={postingForm.input_quantity}
                      onChange={(e) => handlePostingInputQtyChange(parseInt(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-blue-400 font-bold focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] text-slate-400 block">Accepted Qty</label>
                      <span className="text-[9px] text-emerald-400 font-sans font-medium">Input - Rej</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={postingForm.accepted_quantity}
                      onChange={(e) => handlePostingAcceptedQtyChange(parseInt(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-900 border border-emerald-600/60 rounded px-2 py-1 text-emerald-400 font-bold focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Rejected Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={postingForm.rejected_quantity}
                      onChange={(e) => handlePostingRejectedQtyChange(parseInt(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-400 font-bold focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Rework Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={postingForm.rework_quantity}
                      onChange={(e) => handlePostingReworkQtyChange(parseInt(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-400 font-bold focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Balance Rule:</span>
                  <div className="flex items-center space-x-1.5 font-bold">
                    <span className="text-blue-400">Input ({postingForm.input_quantity})</span>
                    <span className="text-slate-500">-</span>
                    <span className="text-rose-400">Rejected ({postingForm.rejected_quantity})</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-emerald-400">Accepted ({postingForm.accepted_quantity})</span>
                  </div>
                </div>
              </div>

              {/* Work Order Quantity to Produce Reconciliation Gate Box */}
              <div
                className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                  woQuantityGate.isExceeded
                    ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                    : 'bg-slate-950 border border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <Scale className="w-4 h-4 text-emerald-400" />
                    <span>Work Order Quantity to Produce Gate</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      woQuantityGate.isExceeded
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {woQuantityGate.isExceeded
                      ? `⚠️ Exceeds WO Target Limit (+${woQuantityGate.excessQty} Pcs)`
                      : `✓ Validated (≤ WO Target Limit)`}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px] font-sans">WO Qty to Produce</div>
                    <div className="font-bold text-white mt-0.5">{woTargetQty} Pcs</div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px] font-sans">Prior Logged (Acc+Rej)</div>
                    <div className="font-bold text-amber-300 mt-0.5">{existingStageAcc + existingStageRej} Pcs</div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px] font-sans">This Posting (Acc+Rej)</div>
                    <div className="font-bold text-blue-300 mt-0.5">
                      {postingForm.accepted_quantity + postingForm.rejected_quantity} Pcs
                    </div>
                  </div>
                  <div
                    className={`p-2 rounded border ${
                      woQuantityGate.isExceeded
                        ? 'bg-rose-950/80 border-rose-700 text-rose-300 font-bold'
                        : 'bg-slate-900/90 border-slate-800 text-emerald-400 font-bold'
                    }`}
                  >
                    <div className="text-slate-400 text-[10px] font-sans">Cumulative / Limit</div>
                    <div className="mt-0.5">
                      {woQuantityGate.cumulativeStageQty} / {woTargetQty} Pcs
                    </div>
                  </div>
                </div>

                {woQuantityGate.isExceeded && (
                  <p className="text-[11px] text-rose-300 bg-rose-950/80 border border-rose-800/80 rounded px-2.5 py-1.5 font-sans">
                    {woQuantityGate.errorMessage}
                  </p>
                )}
              </div>

              {/* Conditional Defect Sub-Form if Rejected > 0 */}
              {postingForm.rejected_quantity > 0 && (
                <div className="p-4 bg-rose-950/20 border border-rose-800/60 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2 text-rose-300 font-semibold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Defect Categorization & Scrap Disposition</span>
                  </div>

                  {postingForm.rejections.map((rej, idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1">Defect Category (14 Options)</label>
                          <select
                            value={rej.defect_category}
                            onChange={(e) => {
                              const updated = [...postingForm.rejections];
                              updated[idx].defect_category = e.target.value as any;
                              setPostingForm({ ...postingForm, rejections: updated });
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                          >
                            {DEFECT_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1">Disposition Action</label>
                          <select
                            value={rej.disposition_action}
                            onChange={(e) => {
                              const updated = [...postingForm.rejections];
                              updated[idx].disposition_action = e.target.value as any;
                              setPostingForm({ ...postingForm, rejections: updated });
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                          >
                            {DISPOSITION_ACTIONS.map((action) => (
                              <option key={action} value={action}>
                                {action}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Inspector Root Cause Remarks</label>
                        <input
                          type="text"
                          placeholder="e.g. Broken tool insert causing flat thread flanks"
                          value={rej.inspector_remarks}
                          onChange={(e) => {
                            const updated = [...postingForm.rejections];
                            updated[idx].inspector_remarks = e.target.value;
                            setPostingForm({ ...postingForm, rejections: updated });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPostingModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!balanceCheck.isBalanced || woQuantityGate.isExceeded}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 shadow-lg shadow-emerald-600/30 transition-all"
                >
                  {isEditPostingMode ? 'Save Routing Changes' : 'Commit Stage Routing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
