# SQLite MCP Server Database Schema

This document describes the schema of the `orders.sqlite` database used with the SQLite MCP Server. The database contains information about customers, articles, employees, units, and orders.

## Database Statistics

| Table Name | Row Count |
|------------|-----------|
| customers  | 595       |
| articles   | 446       |
| employees  | 314       |
| units      | 327       |
| orders     | 2,263     |

## Table Schemas

### customers

The `customers` table stores information about customers, including their contact information and organizational relationships.

```sql
CREATE TABLE customers (
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
```

**Indexes:**
- `idx_customer_vb_unit` on `vb_unit_id`
- `idx_customer_asm_unit` on `asm_unit_id`
- `idx_customer_vl_unit` on `vl_unit_id`

**Sample Data:**
```
503232229|KdName1_541|MICHENDORF|14552
503245568|KdName1_509|WIESBADEN|65205
503250521|KdName1_186|DÖBELN|4720
503251563|KdName1_542|ACHIM|28832
503254657|KdName1_543|BREMEN|28279
```

### articles

The `articles` table stores information about products, including pricing, inventory, and product attributes.

```sql
CREATE TABLE articles (
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
```

**Sample Data:**
```
PEEP.DE.TI06289|PEEP.DE.TI06289|90s Super Show Premium Seat |59.9
PEEP.DE.TI06287|PEEP.DE.TI06287|Janet Jackson Premium Seat |149.25
PEEP.DE.TI06286|PEEP.DE.TI06286|EuroLeague FC Bayern Basketball vs. Real Madrid Ticket Only |0.0
PEEP.DE.WM00024633|PEEP.DE.WM00024633|MO Regaleinschub Stickerzugabe|4.398
PEEP.DE.TI06283|PEEP.DE.TI06283|Champions League - Spieltag 2 - Schachtar Donezk vs. Atalanta Bergamo - Business Seat |299.0
```

### employees

The `employees` table stores information about employees, including their contact information and organizational relationships.

```sql
CREATE TABLE employees (
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
```

**Sample Data:**
```
15|First5 Last5|First5Last5@dreamteam.com
21|First46 Last46|First46Last46@dreamteam.com
24|First197 Last197|First197Last197@dreamteam.com
30|First48 Last48|First48Last48@dreamteam.com
39|First111 Last111|First111Last111@dreamteam.com
```

### units

The `units` table stores information about organizational units, including their hierarchical relationships.

```sql
CREATE TABLE units (
    unit_id INTEGER PRIMARY KEY,
    name TEXT,
    number INTEGER,
    level_id TEXT,
    parent_id INTEGER,
    children_ids TEXT,
    structure_id TEXT,
    custom_attr_personal_number INTEGER
);
```

**Sample Data:**
```
10001|escalatorCo DE812620|
10003|Creature DE812620|
10005|Administration|10000
10017|Partnerships DE812620|10009
10030|ASM DE812620|10020
```

### orders

The `orders` table stores information about orders, including the customer, article, and quantity.

```sql
CREATE TABLE orders (
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
```

**Indexes:**
- `idx_order_customer` on `customer_id`
- `idx_order_postal` on `customer_postal_code`
- `idx_order_article` on `article_id`
- `idx_order_id` on `order_id`
- `idx_order_date` on `order_date`

**Sample Data:**
```
DE.MON.TO.2410-001735|2024-10-06|PROCESSING|NOT_RETURNED|PEEP.DE.WM00022653|3
DE.MON.TO.2410-001735|2024-10-06|PROCESSING|NOT_RETURNED|PEEP.DE.WM00023755|3
DE.MON.TO.2410-001735|2024-10-06|PROCESSING|NOT_RETURNED|PEEP.DE.WM00023096|3
DE.MON.TO.2410-001735|2024-10-06|PROCESSING|NOT_RETURNED|WM00019599|5
DE.MON.TO.2410-001735|2024-10-06|PROCESSING|NOT_RETURNED|PEEP.DE.WM00024321|10
```

## Views

### orders_with_addresses

The `orders_with_addresses` view joins the `orders`, `articles`, `employees`, and `customers` tables to provide a comprehensive view of orders with customer and article details.

```sql
CREATE VIEW orders_with_addresses AS
SELECT 
    o.order_id,
    o.order_date,
    o.status,
    o.article_id,
    a.name AS article_name,
    a.item_number AS article_number,
    o.quantity,
    e.name AS employee_name,
    c.name AS customer_name,
    c.street || ' ' || c.house_number AS address,
    c.postal_code,
    c.city
FROM 
    orders o
LEFT JOIN 
    customers c ON o.customer_id = c.customer_id
LEFT JOIN 
    articles a ON o.article_id = a.article_id
LEFT JOIN
    employees e ON a.responsible_employee_id = e.employee_id;
```

### employee_emails

The `employee_emails` view provides a simple list of employee email addresses.

```sql
CREATE VIEW employee_emails AS 
SELECT email FROM employees;
```

## Example Queries

### 1. Basic Customer Query

Retrieve basic customer information:

```sql
SELECT 
    customer_id, 
    name, 
    city, 
    postal_code 
FROM 
    customers 
LIMIT 5;
```

### 2. Basic Article Query

Retrieve basic article information:

```sql
SELECT 
    article_id, 
    name, 
    price 
FROM 
    articles 
LIMIT 5;
```

### 3. Join Customers and Orders

Find which customers placed orders:

```sql
SELECT 
    o.order_id, 
    o.order_date, 
    c.name AS customer_name, 
    c.city, 
    o.article_id, 
    o.quantity
FROM 
    orders o
JOIN 
    customers c ON o.customer_id = c.customer_id
LIMIT 5;
```

### 4. Join Orders, Articles, and Customers

Get detailed order information with article and customer details:

```sql
SELECT 
    o.order_id, 
    o.order_date, 
    c.name AS customer_name, 
    a.name AS article_name, 
    a.price, 
    o.quantity,
    (a.price * o.quantity) AS total_price
FROM 
    orders o
JOIN 
    customers c ON o.customer_id = c.customer_id
JOIN 
    articles a ON o.article_id = a.article_id
LIMIT 5;
```

### 5. Join Orders with Units through Customers

See which units are associated with orders:

```sql
SELECT 
    o.order_id, 
    c.name AS customer_name, 
    u.name AS unit_name,
    o.article_id,
    o.quantity
FROM 
    orders o
JOIN 
    customers c ON o.customer_id = c.customer_id
JOIN 
    units u ON c.vb_unit_id = u.unit_id
LIMIT 5;
```

### 6. Aggregation Query - Order Statistics by Customer

Get order statistics grouped by customer:

```sql
SELECT 
    c.customer_id,
    c.name AS customer_name,
    c.city,
    COUNT(DISTINCT o.order_id) AS total_orders,
    SUM(o.quantity) AS total_items,
    COUNT(DISTINCT o.article_id) AS unique_articles
FROM 
    customers c
JOIN 
    orders o ON c.customer_id = o.customer_id
GROUP BY 
    c.customer_id
ORDER BY 
    total_orders DESC
LIMIT 5;
```

### 7. Using the orders_with_addresses View

Get comprehensive order information using the view:

```sql
SELECT 
    order_id,
    order_date,
    status,
    article_name,
    article_number,
    quantity,
    customer_name,
    address,
    postal_code,
    city
FROM 
    orders_with_addresses
LIMIT 5;
```

## Relationships

The database has the following key relationships:

1. `orders.customer_id` → `customers.customer_id`
2. `orders.article_id` → `articles.article_id`
3. `customers.vb_unit_id`, `customers.asm_unit_id`, `customers.vl_unit_id` → `units.unit_id`
4. `articles.responsible_employee_id` → `employees.employee_id`
5. `units.parent_id` → `units.unit_id` (self-referencing relationship for hierarchy)

These relationships allow for complex queries that join multiple tables to retrieve comprehensive information about orders, customers, articles, employees, and organizational units.
