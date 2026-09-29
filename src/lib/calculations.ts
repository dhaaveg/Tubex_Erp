/**
 * Cutting Yield Math & Domain Logic
 * Mandatory Enforcements:
 * - Expected_Qty = Tube_Length_mm / Parting_Length_mm
 * - Rounded_Qty = Math.floor(Tube_Length_mm / Parting_Length_mm)
 * - End_Scrap_mm = Tube_Length_mm - (Rounded_Qty * Parting_Length_mm)
 * - Yield % = (Rounded_Qty * Parting_Length_mm) / Tube_Length_mm * 100
 */
export interface CuttingYieldResult {
  expectedQty: number;
  roundedQty: number;
  endScrapMm: number;
  yieldPct: number;
  isValid: boolean;
  errorMessage?: string;
}

export function calculateCuttingYield(
  tubeLengthMm: number,
  partingLengthMm: number
): CuttingYieldResult {
  if (!tubeLengthMm || tubeLengthMm <= 0) {
    return {
      expectedQty: 0,
      roundedQty: 0,
      endScrapMm: 0,
      yieldPct: 0,
      isValid: false,
      errorMessage: 'Tube length must be greater than 0 mm',
    };
  }

  if (!partingLengthMm || partingLengthMm <= 0) {
    return {
      expectedQty: 0,
      roundedQty: 0,
      endScrapMm: 0,
      yieldPct: 0,
      isValid: false,
      errorMessage: 'Parting length must be greater than 0 mm',
    };
  }

  if (partingLengthMm > tubeLengthMm) {
    return {
      expectedQty: Number((tubeLengthMm / partingLengthMm).toFixed(4)),
      roundedQty: 0,
      endScrapMm: tubeLengthMm,
      yieldPct: 0,
      isValid: false,
      errorMessage: 'Parting length exceeds raw tube length',
    };
  }

  const expectedQty = Number((tubeLengthMm / partingLengthMm).toFixed(4));
  const roundedQty = Math.floor(tubeLengthMm / partingLengthMm);
  const endScrapMm = Number((tubeLengthMm - roundedQty * partingLengthMm).toFixed(2));
  const yieldPct = Number((((roundedQty * partingLengthMm) / tubeLengthMm) * 100).toFixed(2));

  return {
    expectedQty,
    roundedQty,
    endScrapMm,
    yieldPct,
    isValid: true,
  };
}

/**
 * Production Quantity Balance Gate
 * Validation Rule:
 * Input_Quantity MUST EQUAL Accepted_Quantity + Rejected_Quantity + Rework_Quantity
 */
export interface ProductionBalanceResult {
  isBalanced: boolean;
  delta: number;
  errorMessage?: string;
}

export function validateProductionBalance(
  inputQuantity: number,
  acceptedQuantity: number,
  rejectedQuantity: number,
  reworkQuantity: number = 0
): ProductionBalanceResult {
  const sumOfOutputs = acceptedQuantity + rejectedQuantity + reworkQuantity;
  const delta = inputQuantity - sumOfOutputs;

  if (delta !== 0) {
    return {
      isBalanced: false,
      delta,
      errorMessage: `Production Balance Violation: "Input Qty" (${inputQuantity}) - "Rejected Qty" (${rejectedQuantity}) must equal "Accepted Qty" (${acceptedQuantity}). (Mismatch delta: ${delta > 0 ? '+' : ''}${delta})`,
    };
  }

  return {
    isBalanced: true,
    delta: 0,
  };
}

/**
 * Weighbridge Weight Difference Calculator
 */
export function calculateWeighbridge(
  invoiceWeightMt: number,
  actualWeighbridgeWeightMt: number
) {
  const weightDifferenceMt = Number(
    (actualWeighbridgeWeightMt - invoiceWeightMt).toFixed(3)
  );
  const variancePct = invoiceWeightMt > 0
    ? Number(((weightDifferenceMt / invoiceWeightMt) * 100).toFixed(2))
    : 0;

  return {
    weightDifferenceMt,
    variancePct,
    isOverweight: weightDifferenceMt > 0,
    isShortweight: weightDifferenceMt < 0,
    isExcessiveVariance: Math.abs(variancePct) > 1.5, // Standard steel tolerance warning
  };
}

/**
 * PO Ordered MT vs Cumulative GRN Invoice MT Reconciliation Gate
 * Rule: Sum of all GRN Invoice MT associated with the same PO No. <= PO's Ordered MT sum
 */
export function validatePoGrnWeightLimit(
  poOrderedMtSum: number,
  existingGrnInvoiceMtSum: number,
  newInvoiceWeightMt: number
) {
  const newCumulativeInvoiceMt = Number((existingGrnInvoiceMtSum + newInvoiceWeightMt).toFixed(3));
  const remainingAllowableMt = Number((poOrderedMtSum - existingGrnInvoiceMtSum).toFixed(3));
  const isExceeded = poOrderedMtSum > 0 && newCumulativeInvoiceMt > Number(poOrderedMtSum.toFixed(3));
  const excessMt = Number((newCumulativeInvoiceMt - poOrderedMtSum).toFixed(3));

  return {
    poOrderedMtSum,
    existingGrnInvoiceMtSum,
    newCumulativeInvoiceMt,
    remainingAllowableMt: Math.max(0, remainingAllowableMt),
    isExceeded,
    excessMt: Math.max(0, excessMt),
    errorMessage: isExceeded
      ? `Total GRN Invoice Weight (${newCumulativeInvoiceMt.toFixed(3)} MT) exceeds Purchase Order's Total Ordered Weight (${poOrderedMtSum.toFixed(3)} MT) by ${excessMt.toFixed(3)} MT. Maximum allowable remaining Invoice Weight is ${Math.max(0, remainingAllowableMt).toFixed(3)} MT.`
      : null,
  };
}

/**
 * Work Order Quantity to Produce Reconciliation Gate
 * Rule: Sum of all (Accepted Qty + Rejected Qty) associated with the same Work Order
 *       for any stage must NOT exceed the Work Order's "Quantity to Produce (User Entry)" (planned_parts_to_produce).
 */
export interface WorkOrderQuantityGateResult {
  woQuantityToProduce: number;
  existingStageQty: number;
  newPostingQty: number;
  cumulativeStageQty: number;
  remainingAllowableQty: number;
  isExceeded: boolean;
  excessQty: number;
  errorMessage: string | null;
}

export function validateWorkOrderStageQuantityLimit(
  woQuantityToProduce: number,
  existingStageAcceptedQty: number,
  existingStageRejectedQty: number,
  newAcceptedQty: number,
  newRejectedQty: number,
  stageName?: string,
  stageSeq?: number
): WorkOrderQuantityGateResult {
  const existingStageQty = Math.max(0, (existingStageAcceptedQty || 0) + (existingStageRejectedQty || 0));
  const newPostingQty = Math.max(0, (newAcceptedQty || 0) + (newRejectedQty || 0));
  const cumulativeStageQty = existingStageQty + newPostingQty;
  const remainingAllowableQty = Math.max(0, woQuantityToProduce - existingStageQty);
  const isExceeded = woQuantityToProduce > 0 && cumulativeStageQty > woQuantityToProduce;
  const excessQty = Math.max(0, cumulativeStageQty - woQuantityToProduce);

  const stageLabel = stageName ? (stageSeq ? `OP ${stageSeq}: ${stageName}` : stageName) : 'this stage';

  const errorMessage = isExceeded
    ? `Work Order Limit Exceeded: Sum of Accepted and Rejected quantities (${cumulativeStageQty} pcs) for ${stageLabel} exceeds the Work Order's "Quantity to Produce (User Entry)" (${woQuantityToProduce} pcs) by ${excessQty} pcs. Maximum allowable remaining for this stage is ${remainingAllowableQty} pcs.`
    : null;

  return {
    woQuantityToProduce,
    existingStageQty,
    newPostingQty,
    cumulativeStageQty,
    remainingAllowableQty,
    isExceeded,
    excessQty,
    errorMessage,
  };
}

export { formatDate, formatDateTime } from './formatters';
