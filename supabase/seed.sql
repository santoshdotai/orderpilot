insert into products (sku, name, price, stock)
values
  ('CEM-001', 'Ultra Cement Bag', 420.00, 120),
  ('STE-010', 'Steel Rod 10mm', 785.00, 80),
  ('PNT-205', 'Premium Exterior Paint', 1640.00, 45),
  ('PLY-018', 'Marine Plywood Sheet', 2890.00, 30)
on conflict (sku) do update
set
  name = excluded.name,
  price = excluded.price,
  stock = excluded.stock;
