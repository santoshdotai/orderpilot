create unique index if not exists idx_orders_quotation_id on orders(quotation_id) where quotation_id is not null;

create or replace function public.create_orderpilot_quotation_draft(message_id uuid, line_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_message messages%rowtype;
  quotation_row quotations%rowtype;
  line_item jsonb;
  matched_product products%rowtype;
  line_qty int;
  line_price numeric(12,2);
  quotation_total numeric(12,2) := 0;
begin
  select *
  into source_message
  from messages
  where id = message_id;

  if not found then
    raise exception 'Message % not found', message_id;
  end if;

  insert into quotations (customer_id, status, total)
  values (source_message.customer_id, 'draft', 0)
  returning * into quotation_row;

  for line_item in
    select *
    from jsonb_array_elements(coalesce(line_items, '[]'::jsonb))
  loop
    line_qty := greatest(coalesce((line_item ->> 'qty')::int, 1), 1);

    select *
    into matched_product
    from products
    where lower(name) = lower(coalesce(line_item ->> 'product_name', line_item ->> 'name', ''))
       or sku = nullif(line_item ->> 'sku', '')
    order by case when sku = nullif(line_item ->> 'sku', '') then 0 else 1 end
    limit 1;

    line_price := coalesce(matched_product.price, 0);
    quotation_total := quotation_total + (line_qty * line_price);

    insert into quotation_items (quotation_id, product_id, qty, unit_price)
    values (quotation_row.id, matched_product.id, line_qty, line_price);
  end loop;

  update quotations
  set total = quotation_total
  where id = quotation_row.id
  returning * into quotation_row;

  return jsonb_build_object(
    'quotation_id', quotation_row.id,
    'customer_id', quotation_row.customer_id,
    'status', quotation_row.status,
    'total', quotation_row.total
  );
end;
$$;
