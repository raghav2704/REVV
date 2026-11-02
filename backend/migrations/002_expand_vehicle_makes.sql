
-- ============================================================
-- REVV VEHICLE CATALOGUE
-- Migration 002: Expanded Manufacturer Catalogue
--
-- Additive and safe to re-run.
-- Preserves existing vehicles, makes and models.
-- ============================================================

BEGIN;

INSERT INTO vehicle_makes (name)
VALUES

-- ============================================================
-- JAPANESE BRANDS
-- ============================================================

('Acura'),
('Daihatsu'),
('Datsun'),
('Hino'),
('Honda'),
('Infiniti'),
('Isuzu'),
('Lexus'),
('Mazda'),
('Mitsubishi'),
('Mitsuoka'),
('Nissan'),
('Subaru'),
('Suzuki'),
('Toyota'),

-- ============================================================
-- GERMAN BRANDS
-- ============================================================

('Alpina'),
('Audi'),
('BMW'),
('BMW Motorrad'),
('Mercedes-Benz'),
('Mercedes-AMG'),
('Opel'),
('Porsche'),
('Smart'),
('Volkswagen'),
('Wiesmann'),

-- ============================================================
-- BRITISH BRANDS
-- ============================================================

('Aston Martin'),
('Bentley'),
('Caterham'),
('Jaguar'),
('Land Rover'),
('Lotus'),
('McLaren'),
('MG'),
('Mini'),
('Morgan'),
('Rolls-Royce'),
('TVR'),
('Vauxhall'),

-- ============================================================
-- ITALIAN BRANDS
-- ============================================================

('Abarth'),
('Alfa Romeo'),
('De Tomaso'),
('Ferrari'),
('Fiat'),
('Lamborghini'),
('Lancia'),
('Maserati'),
('Pagani'),

-- ============================================================
-- FRENCH BRANDS
-- ============================================================

('Alpine'),
('Bugatti'),
('Citroen'),
('DS Automobiles'),
('Peugeot'),
('Renault'),

-- ============================================================
-- SWEDISH BRANDS
-- ============================================================

('Koenigsegg'),
('Polestar'),
('Saab'),
('Volvo'),

-- ============================================================
-- AMERICAN BRANDS
-- ============================================================

('Buick'),
('Cadillac'),
('Chevrolet'),
('Chrysler'),
('Dodge'),
('Ford'),
('GMC'),
('Hummer'),
('Jeep'),
('Lincoln'),
('Lucid'),
('Oldsmobile'),
('Pontiac'),
('Ram'),
('Rivian'),
('Saturn'),
('Tesla'),

-- ============================================================
-- SOUTH KOREAN BRANDS
-- ============================================================

('Daewoo'),
('Genesis'),
('Hyundai'),
('KGM'),
('Kia'),
('SsangYong'),

-- ============================================================
-- CHINESE AND EMERGING BRANDS
-- ============================================================

('Aion'),
('Avatr'),
('BAIC'),
('BYD'),
('Changan'),
('Chery'),
('Deepal'),
('Denza'),
('Dongfeng'),
('Fangchengbao'),
('Foton'),
('Geely'),
('GWM'),
('Haval'),
('Hongqi'),
('Jaecoo'),
('JAC'),
('Jetour'),
('Leapmotor'),
('Li Auto'),
('Lynk & Co'),
('Neta'),
('Nio'),
('Omoda'),
('Ora'),
('Roewe'),
('Seres'),
('Tank'),
('Voyah'),
('Wuling'),
('Xiaomi'),
('XPeng'),
('Yangwang'),
('Zeekr'),

-- ============================================================
-- EUROPEAN BRANDS
-- ============================================================

('Cupra'),
('Dacia'),
('KTM'),
('SEAT'),
('Skoda'),

-- ============================================================
-- INDIAN BRANDS
-- ============================================================

('Mahindra'),
('Maruti Suzuki'),
('Tata'),

-- ============================================================
-- OTHER AND HISTORIC BRANDS
-- ============================================================

('Holden'),
('Proton'),
('Perodua'),
('Togg'),
('VinFast'),
('Zastava'),

-- ============================================================
-- SPECIALIST / COMMERCIAL VEHICLES
-- ============================================================

('Iveco'),
('LDV'),
('MAN'),
('Scania'),

-- ============================================================
-- OTHER / UNLISTED MANUFACTURER
-- ============================================================

('Other')

ON CONFLICT (name) DO NOTHING;

COMMIT;
