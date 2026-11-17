UPDATE "products" SET "category" = CASE
  WHEN "name" ~* '(- celana$|^celana )' THEN 'Seragam Celana'
  WHEN "name" ~* '(- baju$|baju saja|^atasan |^kaos )' THEN 'Seragam Baju'
  ELSE 'Seragam Setelan'
END
WHERE "category" = 'Seragam';
