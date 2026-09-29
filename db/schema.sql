-- ============================================================================
-- PRODUCTION-GRADE POSTGRESQL DDL SCRIPT FOR TUBE & PIPE PROCESSING ERP
-- Compliant with strict relational integrity, check constraints, and indexes
-- ============================================================================

-- Drop existing tables if needed (in reverse dependency order)
DROP TABLE IF EXISTS Rejection_Posting CASCADE;
DROP TABLE IF EXISTS Production_Posting CASCADE;
DROP TABLE IF EXISTS Work_Order CASCADE;
DROP TABLE IF EXISTS Tally_Items CASCADE;
DROP TABLE IF EXISTS Tally_Sheet CASCADE;
DROP TABLE IF EXISTS GRN_Items CASCADE;
DROP TABLE IF EXISTS GRN CASCADE;
DROP TABLE IF EXISTS PO_Items CASCADE;
DROP TABLE IF EXISTS Purchase_Order CASCADE;
DROP TABLE IF EXISTS Product CASCADE;
DROP TABLE IF EXISTS Supplier CASCADE;

-- 1. SUPPLIER MASTER TABLE
CREATE TABLE Supplier (
    Supplier_Id VARCHAR(50) PRIMARY KEY,
    Supplier_Name VARCHAR(255) NOT NULL,
    Supplier_Onboarding_Date DATE NOT NULL,
    Supplier_Address TEXT NOT NULL,
    Contact_Person VARCHAR(150) NOT NULL,
    Telephone_No VARCHAR(50) NOT NULL,
    Supplier_Mail VARCHAR(150) NOT NULL,
    Mill_Name VARCHAR(255) NOT NULL,
    Mill_Address TEXT NOT NULL,
    GST_Tax_ID VARCHAR(50) NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (Status IN ('Active', 'Inactive')),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCT MASTER TABLE (API 5CT / Line Pipe Spec)
CREATE TABLE Product (
    Product_Id VARCHAR(50) PRIMARY KEY,
    Product_Description TEXT NOT NULL,
    Size_OD NUMERIC(8, 3) NOT NULL CHECK (Size_OD > 0),
    Wall_Thickness NUMERIC(8, 3) NOT NULL CHECK (Wall_Thickness > 0),
    Grade VARCHAR(50) NOT NULL, -- e.g. J55, K55, L80, P110, Q125
    Thread_Type VARCHAR(50) NOT NULL, -- e.g. BTC, LTC, STC, Premium
    CVN_Requirement VARCHAR(100) NOT NULL, -- Charpy V-Notch impact criteria
    Nominal_Weight_kg_m NUMERIC(10, 3) NOT NULL CHECK (Nominal_Weight_kg_m > 0),
    UOM VARCHAR(20) NOT NULL DEFAULT 'Meters',
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PURCHASE ORDER TABLE (Header)
CREATE TABLE Purchase_Order (
    PO_No VARCHAR(50) PRIMARY KEY,
    PO_Date DATE NOT NULL,
    Supplier_Id VARCHAR(50) NOT NULL REFERENCES Supplier(Supplier_Id) ON DELETE RESTRICT,
    Shipping_Address TEXT NOT NULL,
    Delivery_Date DATE NOT NULL,
    Payment_Terms VARCHAR(100) NOT NULL,
    Advance_Amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (Advance_Amount >= 0),
    Remaining_Amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    PO_Status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (PO_Status IN ('Draft', 'Approved', 'Open', 'Closed')),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PO ITEMS TABLE (Lines)
CREATE TABLE PO_Items (
    PO_Item_Id VARCHAR(50) PRIMARY KEY,
    PO_No VARCHAR(50) NOT NULL REFERENCES Purchase_Order(PO_No) ON DELETE CASCADE,
    Product_Id VARCHAR(50) NOT NULL REFERENCES Product(Product_Id) ON DELETE RESTRICT,
    Ordered_Qty NUMERIC(12, 2) NOT NULL CHECK (Ordered_Qty > 0),
    Ordered_Qty_MT NUMERIC(12, 3) NOT NULL CHECK (Ordered_Qty_MT >= 0),
    Unit_Rate NUMERIC(12, 2) NOT NULL CHECK (Unit_Rate >= 0),
    Line_Total NUMERIC(14, 2) GENERATED ALWAYS AS (Ordered_Qty * Unit_Rate) STORED,
    Tolerable_Variance_Pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    Line_Status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (Line_Status IN ('Pending', 'Partially Received', 'Fulfilled')),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. GOODS RECEIPT NOTE TABLE (Header)
CREATE TABLE GRN (
    GRN_Id VARCHAR(50) PRIMARY KEY,
    GRN_Date DATE NOT NULL,
    PO_No VARCHAR(50) NOT NULL REFERENCES Purchase_Order(PO_No) ON DELETE RESTRICT,
    Invoice_No VARCHAR(100) NOT NULL,
    Invoice_Date DATE NOT NULL,
    Vehicle_Transporter_No VARCHAR(50) NOT NULL,
    Invoice_Weight_MT NUMERIC(12, 3) NOT NULL CHECK (Invoice_Weight_MT >= 0),
    Actual_Weighbridge_Weight_MT NUMERIC(12, 3) NOT NULL CHECK (Actual_Weighbridge_Weight_MT >= 0),
    Weight_Difference_MT NUMERIC(12, 3) GENERATED ALWAYS AS (Actual_Weighbridge_Weight_MT - Invoice_Weight_MT) STORED,
    Total_Tubes_Received_Actual INT NOT NULL CHECK (Total_Tubes_Received_Actual >= 0),
    Total_Tubes_Tally INT NOT NULL DEFAULT 0,
    Tally_Match_Status VARCHAR(20) NOT NULL DEFAULT 'Mismatch' CHECK (Tally_Match_Status IN ('Matched', 'Mismatch')),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. GRN ITEMS TABLE (Lines)
CREATE TABLE GRN_Items (
    GRN_Item_Id VARCHAR(50) PRIMARY KEY,
    GRN_Id VARCHAR(50) NOT NULL REFERENCES GRN(GRN_Id) ON DELETE CASCADE,
    PO_Item_Id VARCHAR(50) NOT NULL REFERENCES PO_Items(PO_Item_Id) ON DELETE RESTRICT,
    Product_Id VARCHAR(50) NOT NULL REFERENCES Product(Product_Id) ON DELETE RESTRICT,
    Invoice_Quantity NUMERIC(12, 2) NOT NULL CHECK (Invoice_Quantity >= 0),
    Received_Quantity NUMERIC(12, 2) NOT NULL CHECK (Received_Quantity >= 0),
    Rejected_Damaged_Qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (Rejected_Damaged_Qty >= 0),
    Item_Inspection_Status VARCHAR(30) NOT NULL DEFAULT 'Pending QA' CHECK (Item_Inspection_Status IN ('Pending QA', 'Accepted', 'Rejected')),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TALLY SHEET TABLE (Lot & Heat Master)
CREATE TABLE Tally_Sheet (
    TS_Id VARCHAR(50) PRIMARY KEY,
    GRN_Item_Id VARCHAR(50) NOT NULL REFERENCES GRN_Items(GRN_Item_Id) ON DELETE CASCADE,
    Lot_No VARCHAR(50) NOT NULL,
    Heat_No VARCHAR(50) NOT NULL,
    Mill_Test_Certificate_No VARCHAR(100) NOT NULL,
    Tally_Sheet_Date DATE NOT NULL,
    Inspector_Name VARCHAR(150) NOT NULL,
    Bundle_Count INT NOT NULL DEFAULT 1 CHECK (Bundle_Count > 0),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TALLY ITEMS TABLE (Pipe-by-Pipe Dimensional Log)
CREATE TABLE Tally_Items (
    TI_Id VARCHAR(100) PRIMARY KEY, -- Barcode / Tube Tag
    TS_Id VARCHAR(50) NOT NULL REFERENCES Tally_Sheet(TS_Id) ON DELETE CASCADE,
    Tube_Sr_No INT NOT NULL CHECK (Tube_Sr_No > 0),
    Tube_Length_mm NUMERIC(10, 2) NOT NULL CHECK (Tube_Length_mm > 0),
    Parting_Length_mm NUMERIC(10, 2) NOT NULL CHECK (Parting_Length_mm > 0),
    Expected_Qty NUMERIC(10, 4) GENERATED ALWAYS AS (Tube_Length_mm / Parting_Length_mm) STORED,
    Rounded_Qty INT GENERATED ALWAYS AS (FLOOR(Tube_Length_mm / Parting_Length_mm)) STORED,
    End_Scrap_mm NUMERIC(10, 2) GENERATED ALWAYS AS (Tube_Length_mm - (FLOOR(Tube_Length_mm / Parting_Length_mm) * Parting_Length_mm)) STORED,
    Pipe_Allocation_Status VARCHAR(20) NOT NULL DEFAULT 'Available' CHECK (Pipe_Allocation_Status IN ('Available', 'Allocated', 'Consumed', 'Scrapped')),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. WORK ORDER TABLE (Shop Job Card)
CREATE TABLE Work_Order (
    WO_Id VARCHAR(50) PRIMARY KEY,
    WO_Date DATE NOT NULL,
    TI_Id VARCHAR(100) NOT NULL REFERENCES Tally_Items(TI_Id) ON DELETE RESTRICT,
    Target_Product_Id VARCHAR(50) NOT NULL REFERENCES Product(Product_Id) ON DELETE RESTRICT,
    Planned_Parts_To_Produce INT NOT NULL CHECK (Planned_Parts_To_Produce > 0),
    Machine_Line_No VARCHAR(50) NOT NULL,
    Shift VARCHAR(20) NOT NULL CHECK (Shift IN ('Shift A', 'Shift B', 'Shift C')),
    WO_Status VARCHAR(20) NOT NULL DEFAULT 'Released' CHECK (WO_Status IN ('Released', 'In Progress', 'Completed', 'Closed')),
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. PRODUCTION POSTING TABLE (Routing Logs)
CREATE TABLE Production_Posting (
    PP_Id VARCHAR(50) PRIMARY KEY,
    WO_Id VARCHAR(50) NOT NULL REFERENCES Work_Order(WO_Id) ON DELETE CASCADE,
    Process_Stage_Name VARCHAR(50) NOT NULL CHECK (Process_Stage_Name IN (
        'Cutting', 'ID Roughing', 'OD Roughing', 'Threading', 'MPI', 'Phosphating', 'Painting', 'Packing'
    )),
    Operation_Seq_No INT NOT NULL, -- 10, 20, 30, 40, 50, 60, 70, 80
    Operator_Machine_Id VARCHAR(50) NOT NULL,
    Input_Quantity INT NOT NULL CHECK (Input_Quantity >= 0),
    Accepted_Quantity INT NOT NULL CHECK (Accepted_Quantity >= 0),
    Rejected_Quantity INT NOT NULL CHECK (Rejected_Quantity >= 0),
    Rework_Quantity INT NOT NULL CHECK (Rework_Quantity >= 0),
    Stage_Completion_Timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Balance Gate Constraint: Input must equal Accepted + Rejected + Rework
    CONSTRAINT chk_production_balance_gate CHECK (Input_Quantity = Accepted_Quantity + Rejected_Quantity + Rework_Quantity)
);

-- 11. REJECTION POSTING TABLE (Defect Categorization)
CREATE TABLE Rejection_Posting (
    RP_Id VARCHAR(50) PRIMARY KEY,
    PP_Id VARCHAR(50) NOT NULL REFERENCES Production_Posting(PP_Id) ON DELETE CASCADE,
    WO_Id VARCHAR(50) NOT NULL REFERENCES Work_Order(WO_Id) ON DELETE CASCADE,
    Defect_Category VARCHAR(100) NOT NULL CHECK (Defect_Category IN (
        'MPI Rejection',
        'Material Fault (M.F.)',
        'Thread Mismatch',
        'Thread Step',
        'Total Length Undersize',
        'OD Undersize',
        'Thread Flat',
        'Thread Cut',
        'Thread Cut Due to Power off',
        'Standoff Undersize/Oversize',
        'ID Oversize',
        'Chatter Mark',
        'Bearing Face Undersize',
        'Short Qty'
    )),
    Defect_Quantity INT NOT NULL CHECK (Defect_Quantity > 0),
    Disposition_Action VARCHAR(30) NOT NULL CHECK (Disposition_Action IN (
        'Scrap', 'Down-grade', 'Recut Short', 'Rework Thread'
    )),
    Inspector_Remarks TEXT,
    Logged_Timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Created_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR FAST TRACEABILITY AND RELATIONAL JOINS
CREATE INDEX idx_po_supplier ON Purchase_Order(Supplier_Id);
CREATE INDEX idx_poi_po ON PO_Items(PO_No);
CREATE INDEX idx_poi_product ON PO_Items(Product_Id);
CREATE INDEX idx_grn_po ON GRN(PO_No);
CREATE INDEX idx_grni_grn ON GRN_Items(GRN_Id);
CREATE INDEX idx_ts_heat ON Tally_Sheet(Heat_No);
CREATE INDEX idx_ts_lot ON Tally_Sheet(Lot_No);
CREATE INDEX idx_ti_ts ON Tally_Items(TS_Id);
CREATE INDEX idx_ti_status ON Tally_Items(Pipe_Allocation_Status);
CREATE INDEX idx_wo_ti ON Work_Order(TI_Id);
CREATE INDEX idx_wo_status ON Work_Order(WO_Status);
CREATE INDEX idx_pp_wo ON Production_Posting(WO_Id);
CREATE INDEX idx_rp_pp ON Rejection_Posting(PP_Id);
CREATE INDEX idx_rp_wo ON Rejection_Posting(WO_Id);
