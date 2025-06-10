-- Step 1: Create the new ProductImage table
CREATE TABLE ProductImage (
                              IDImage INT AUTO_INCREMENT PRIMARY KEY,
                              IDProduct INT NOT NULL,
                              FileName VARCHAR(255) NOT NULL,
                              DisplayOrder INT DEFAULT 0,
                              FOREIGN KEY (IDProduct) REFERENCES Product(IDProduct) ON DELETE CASCADE
);
-- Step 2: Migrate existing images from Product.NameImgProduct
-- Assumes old column is called NameImgProduct
INSERT INTO ProductImage (IDProduct, FileName, DisplayOrder)
SELECT IDProduct, NameImgProduct, 0
FROM Product
WHERE NameImgProduct IS NOT NULL AND NameImgProduct != '';
