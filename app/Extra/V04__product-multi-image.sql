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


CREATE TABLE ProducerImage (
                              IDImage INT AUTO_INCREMENT PRIMARY KEY,
                              IDProducer INT NOT NULL,
                              FileName VARCHAR(255) NOT NULL,
                              DisplayOrder INT DEFAULT 0,
                              FOREIGN KEY (IDProducer) REFERENCES Producer(IDProducer) ON DELETE CASCADE
);
INSERT INTO ProducerImage (IDProducer, FileName, DisplayOrder)
SELECT IDProducer, NameImgProducer, 0
FROM Producer
WHERE NameImgProducer IS NOT NULL AND NameImgProducer != '';
