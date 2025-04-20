-- Drop existing views first
DROP VIEW IF EXISTS Orders_With_Addresses;
DROP VIEW IF EXISTS EmployeeEmails;

-- Rename columns in Customers table
CREATE TABLE customers_new (
    customer_id INTEGER PRIMARY KEY,
    name TEXT,
    name2 TEXT,
    street TEXT,
    house_number TEXT,
    postal_code INTEGER,
    city TEXT,
    phone1 TEXT,
    phone2 TEXT,
    customer_class TEXT,
    stc_id INTEGER,
    stc TEXT,
    vb INTEGER,
    asm_unit_id INTEGER,
    vl_unit_id INTEGER,
    vb_unit_id INTEGER,
    payment_term TEXT,
    payment_term_sp TEXT,
    customer_group TEXT,
    parent_group TEXT
);

INSERT INTO customers_new 
SELECT 
    Kundennummer,
    Name,
    "Name 2",
    Straße,
    Nummer,
    PLZ,
    Stadt,
    "Telefone 1",
    "Telefone 2",
    Kundenklasse,
    "STC ID",
    STC,
    VB,
    ASM_Unit_Id,
    VL_Unit_Id,
    VB_Unit_Id,
    ZTerm,
    ZTermSP,
    "Group",
    "Parent Group"
FROM Customers;

DROP TABLE Customers;
ALTER TABLE customers_new RENAME TO customers;

-- Rename columns in Articles table
CREATE TABLE articles_new (
    article_id TEXT PRIMARY KEY,
    item_number TEXT,
    name TEXT,
    ordering_unit_name TEXT,
    description TEXT,
    valid_during TEXT,
    keywords TEXT,
    ordering_unit INTEGER,
    serial_number_required TEXT,
    batch_number_required TEXT,
    type TEXT,
    package_count INTEGER,
    packaging_unit INTEGER,
    packed_dimensions TEXT,
    packed_volume REAL,
    packed_weight_kg REAL,
    constructed_dimensions TEXT,
    constructed_weight_kg REAL,
    max_orderable INTEGER,
    min_orderable INTEGER,
    allow_returns TEXT,
    price REAL,
    ordering_unit_price REAL,
    purchase_price REAL,
    responsible_employee_id INTEGER,
    min_stock INTEGER,
    has_expiration_date TEXT,
    notify_on_low_stock TEXT,
    book_stock_change_to TEXT,
    state TEXT,
    approval_comment TEXT,
    associated_product_ids TEXT,
    image_ids TEXT,
    master_id TEXT,
    product_config_ids TEXT,
    category_ids TEXT,
    catalog_ids TEXT,
    tax_class_id TEXT,
    custom_attr_stcs TEXT,
    custom_attr_brand TEXT,
    custom_attr_asset_types TEXT,
    custom_attr_region TEXT,
    custom_attr_classification TEXT,
    custom_attr_product_rank TEXT,
    product_permission_employee_ids TEXT
);

INSERT INTO articles_new 
SELECT 
    Id,
    "Item Number",
    Name,
    "Ordering Unit Article Name",
    Description,
    "Valid During",
    Keywords,
    "Ordering Unit",
    "Serial Number Required",
    "Batch Number Required",
    Type,
    "Number Of Packages",
    "Packaging Unit",
    "Packed Dimensions",
    "Packed Volume",
    "Packed Weight In Kg",
    "Constructed Dimensions",
    "Constructed Weight In Kg",
    "Max Orderable",
    "Min Orderable",
    "Allow Return Shipments",
    Price,
    "Ordering Unit Price",
    "Purchase Price",
    "Responsible Employee Id",
    "Min Stock",
    "Has Expiration Date",
    "Notify On Low Stock",
    "Book Stock Change To",
    State,
    "Approval Comment",
    "Associated Products - Ids",
    "Images - Ids",
    "Master - Id",
    "Product Configurations - Ids",
    "Categories - Ids",
    "Catalogs - Ids",
    "Tax Class - Id",
    "Custom Attributes - Stcs",
    "Custom Attributes - Brand",
    "Custom Attributes - Asset Arten",
    "Custom Attributes - Region",
    "Custom Attributes - Classification",
    "Custom Attributes - Product Rank",
    "Product Permissions - Employee IDs"
FROM Articles;

DROP TABLE Articles;
ALTER TABLE articles_new RENAME TO articles;

-- Rename columns in Employees table
CREATE TABLE employees_new (
    employee_id INTEGER PRIMARY KEY,
    name TEXT,
    number INTEGER,
    personal_number INTEGER,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    address TEXT,
    birth_date TEXT,
    employment_start_date TEXT,
    inactive TEXT,
    organization_unit_ids INTEGER,
    assistant_ids TEXT
);

INSERT INTO employees_new 
SELECT 
    Id,
    Name,
    Number,
    "Personal Number",
    "First Name",
    "Last Name",
    Email,
    Address,
    "Date Of Birth",
    "Employment Start Date",
    Inactive,
    "PEEP Organization - Units - Ids",
    "Assistants - Ids"
FROM Employees;

DROP TABLE Employees;
ALTER TABLE employees_new RENAME TO employees;

-- Rename columns in Units table
CREATE TABLE units_new (
    unit_id INTEGER PRIMARY KEY,
    name TEXT,
    number INTEGER,
    level_id TEXT,
    parent_id INTEGER,
    children_ids TEXT,
    structure_id TEXT,
    custom_attr_personal_number INTEGER
);

INSERT INTO units_new 
SELECT 
    Id,
    Name,
    Number,
    "Level - Id",
    "Parent - Id",
    "Children - Ids",
    "Structure - Id",
    "Custom Attributes - Personal Number"
FROM Units;

DROP TABLE Units;
ALTER TABLE units_new RENAME TO units;

-- Rename columns in Order_Item_2024 table
CREATE TABLE orders_new (
    order_id TEXT,
    order_date TEXT,
    status TEXT,
    return_status TEXT,
    article_id TEXT,
    quantity INTEGER,
    customer_id INTEGER,
    customer_name TEXT,
    customer_address TEXT,
    customer_postal_code INTEGER,
    customer_city TEXT,
    article_name TEXT,
    article_number TEXT,
    PRIMARY KEY (order_id, article_id)
);

INSERT INTO orders_new 
SELECT 
    Bestellungsnummer,
    Erstelldatum,
    Status,
    "Retour Status",
    "Artikel ID",
    Menge,
    Customer_Id,
    Customer_Name,
    Customer_Address,
    Customer_PostalCode,
    Customer_City,
    Article_Name,
    Article_Number
FROM Order_Item_2024;

DROP TABLE Order_Item_2024;
ALTER TABLE orders_new RENAME TO orders;

-- Recreate the indexes
CREATE INDEX idx_customer_vb_unit ON customers(vb_unit_id);
CREATE INDEX idx_customer_asm_unit ON customers(asm_unit_id);
CREATE INDEX idx_customer_vl_unit ON customers(vl_unit_id);
CREATE INDEX idx_order_customer ON orders(customer_id);
CREATE INDEX idx_order_postal ON orders(customer_postal_code);
CREATE INDEX idx_order_article ON orders(article_id);
CREATE INDEX idx_order_id ON orders(order_id);
CREATE INDEX idx_order_date ON orders(order_date);

-- Recreate the views with the new column names
CREATE VIEW orders_with_addresses AS
SELECT 
    o.order_id,
    o.order_date,
    o.status,
    o.article_id,
    a.name AS article_name,
    a.item_number AS article_number,
    o.quantity,
    c.name AS customer_name,
    c.street || ' ' || c.house_number AS address,
    c.postal_code,
    c.city
FROM 
    orders o
JOIN 
    customers c ON o.customer_id = c.customer_id
LEFT JOIN 
    articles a ON o.article_id = a.article_id;

-- Create view for employee emails
CREATE VIEW employee_emails AS 
SELECT email FROM employees;

-- Drop unused tables and views
DROP TABLE IF EXISTS Order_Item_2024_Backup;
DROP TABLE IF EXISTS Key;
DROP TABLE IF EXISTS _source_info_;
DROP VIEW IF EXISTS Orders_With_Addresses;
