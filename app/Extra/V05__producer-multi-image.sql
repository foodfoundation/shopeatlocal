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
