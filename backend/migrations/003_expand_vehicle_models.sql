
-- ============================================================
-- REVV VEHICLE CATALOGUE
-- Migration 003: Expanded Vehicle Models
--
-- Preserves all existing makes, models and listings.
-- Safe to run more than once.
-- ============================================================

BEGIN;

WITH catalogue(make_name, model_name) AS (
    VALUES

    -- BMW
    ('BMW', '1 Series'),
    ('BMW', '2 Series'),
    ('BMW', '3 Series'),
    ('BMW', '4 Series'),
    ('BMW', '5 Series'),
    ('BMW', '7 Series'),
    ('BMW', '8 Series'),
    ('BMW', 'X2'),
    ('BMW', 'X4'),
    ('BMW', 'X6'),
    ('BMW', 'X7'),
    ('BMW', 'XM'),
    ('BMW', 'Z4'),
    ('BMW', 'i3'),
    ('BMW', 'i4'),
    ('BMW', 'i5'),
    ('BMW', 'i7'),
    ('BMW', 'iX'),
    ('BMW', 'iX1'),
    ('BMW', 'M2'),
    ('BMW', 'M5'),
    ('BMW', 'M8'),

    -- AUDI
    ('Audi', 'A1'),
    ('Audi', 'A7'),
    ('Audi', 'A8'),
    ('Audi', 'Q2'),
    ('Audi', 'Q4 e-tron'),
    ('Audi', 'Q7'),
    ('Audi', 'Q8'),
    ('Audi', 'e-tron'),
    ('Audi', 'e-tron GT'),
    ('Audi', 'S3'),
    ('Audi', 'S4'),
    ('Audi', 'S5'),
    ('Audi', 'RS4'),
    ('Audi', 'RS5'),
    ('Audi', 'RS6'),
    ('Audi', 'RS7'),
    ('Audi', 'TT'),

    -- MERCEDES-BENZ
    ('Mercedes-Benz', 'B-Class'),
    ('Mercedes-Benz', 'CLA'),
    ('Mercedes-Benz', 'CLS'),
    ('Mercedes-Benz', 'S-Class'),
    ('Mercedes-Benz', 'GLA'),
    ('Mercedes-Benz', 'GLB'),
    ('Mercedes-Benz', 'GLS'),
    ('Mercedes-Benz', 'G-Class'),
    ('Mercedes-Benz', 'EQA'),
    ('Mercedes-Benz', 'EQB'),
    ('Mercedes-Benz', 'EQC'),
    ('Mercedes-Benz', 'EQE'),
    ('Mercedes-Benz', 'EQS'),
    ('Mercedes-Benz', 'Sprinter'),
    ('Mercedes-Benz', 'V-Class'),
    ('Mercedes-Benz', 'AMG GT'),

    -- TOYOTA
    ('Toyota', 'Yaris'),
    ('Toyota', 'Yaris Cross'),
    ('Toyota', 'C-HR'),
    ('Toyota', 'Highlander'),
    ('Toyota', 'Land Cruiser'),
    ('Toyota', 'Land Cruiser Prado'),
    ('Toyota', 'Aqua'),
    ('Toyota', 'Vitz'),
    ('Toyota', 'Harrier'),
    ('Toyota', 'Wish'),
    ('Toyota', 'Estima'),
    ('Toyota', 'Alphard'),
    ('Toyota', 'Vellfire'),
    ('Toyota', 'Hiace'),
    ('Toyota', 'Sienna'),
    ('Toyota', '86'),
    ('Toyota', 'GR86'),
    ('Toyota', 'GR Yaris'),
    ('Toyota', 'bZ4X'),
    ('Toyota', 'Fortuner'),
    ('Toyota', 'Corolla Cross'),
    ('Toyota', 'Probox'),

    -- MAZDA
    ('Mazda', 'Mazda2'),
    ('Mazda', 'CX-30'),
    ('Mazda', 'CX-50'),
    ('Mazda', 'CX-8'),
    ('Mazda', 'CX-9'),
    ('Mazda', 'CX-80'),
    ('Mazda', 'CX-90'),
    ('Mazda', 'MX-30'),
    ('Mazda', 'BT-50'),
    ('Mazda', 'Axela'),
    ('Mazda', 'Atenza'),
    ('Mazda', 'Demio'),
    ('Mazda', 'Premacy'),

    -- HONDA
    ('Honda', 'Accord'),
    ('Honda', 'Fit'),
    ('Honda', 'HR-V'),
    ('Honda', 'ZR-V'),
    ('Honda', 'Odyssey'),
    ('Honda', 'Stepwgn'),
    ('Honda', 'Freed'),
    ('Honda', 'Vezel'),
    ('Honda', 'NSX'),
    ('Honda', 'S2000'),
    ('Honda', 'e'),

    -- NISSAN
    ('Nissan', 'Qashqai'),
    ('Nissan', 'Juke'),
    ('Nissan', 'Patrol'),
    ('Nissan', 'Skyline'),
    ('Nissan', 'GT-R'),
    ('Nissan', '370Z'),
    ('Nissan', 'Fairlady Z'),
    ('Nissan', 'Note'),
    ('Nissan', 'Tiida'),
    ('Nissan', 'Serena'),
    ('Nissan', 'Elgrand'),
    ('Nissan', 'Murano'),
    ('Nissan', 'Pathfinder'),
    ('Nissan', 'Ariya'),
    ('Nissan', 'March'),

    -- MITSUBISHI
    ('Mitsubishi', 'ASX'),
    ('Mitsubishi', 'Eclipse Cross'),
    ('Mitsubishi', 'Pajero'),
    ('Mitsubishi', 'Pajero Sport'),
    ('Mitsubishi', 'Lancer'),
    ('Mitsubishi', 'Lancer Evolution'),
    ('Mitsubishi', 'Mirage'),
    ('Mitsubishi', 'Delica'),
    ('Mitsubishi', 'Colt'),

    -- SUBARU
    ('Subaru', 'Impreza'),
    ('Subaru', 'Legacy'),
    ('Subaru', 'Levorg'),
    ('Subaru', 'XV'),
    ('Subaru', 'Crosstrek'),
    ('Subaru', 'BRZ'),
    ('Subaru', 'Solterra'),
    ('Subaru', 'Ascent'),

    -- SUZUKI
    ('Suzuki', 'Swift'),
    ('Suzuki', 'Vitara'),
    ('Suzuki', 'S-Cross'),
    ('Suzuki', 'Jimny'),
    ('Suzuki', 'Baleno'),
    ('Suzuki', 'Ignis'),
    ('Suzuki', 'Alto'),
    ('Suzuki', 'Celerio'),
    ('Suzuki', 'Every'),

    -- FORD
    ('Ford', 'Focus'),
    ('Ford', 'Fiesta'),
    ('Ford', 'Escape'),
    ('Ford', 'Endura'),
    ('Ford', 'Puma'),
    ('Ford', 'Territory'),
    ('Ford', 'Transit'),
    ('Ford', 'Transit Custom'),
    ('Ford', 'F-150'),
    ('Ford', 'Ranger Raptor'),
    ('Ford', 'Mustang Mach-E'),

    -- HYUNDAI
    ('Hyundai', 'Kona'),
    ('Hyundai', 'Venue'),
    ('Hyundai', 'Palisade'),
    ('Hyundai', 'Ioniq'),
    ('Hyundai', 'Ioniq 5'),
    ('Hyundai', 'Ioniq 6'),
    ('Hyundai', 'Ioniq 9'),
    ('Hyundai', 'Staria'),
    ('Hyundai', 'Sonata'),
    ('Hyundai', 'Accent'),

    -- KIA
    ('Kia', 'Picanto'),
    ('Kia', 'Rio'),
    ('Kia', 'Cerato'),
    ('Kia', 'Seltos'),
    ('Kia', 'Niro'),
    ('Kia', 'Carnival'),
    ('Kia', 'Stinger'),
    ('Kia', 'EV3'),
    ('Kia', 'EV4'),
    ('Kia', 'EV5'),
    ('Kia', 'EV6'),
    ('Kia', 'EV9'),
    ('Kia', 'Tasman'),

    -- VOLKSWAGEN
    ('Volkswagen', 'Passat'),
    ('Volkswagen', 'Arteon'),
    ('Volkswagen', 'T-Roc'),
    ('Volkswagen', 'T-Cross'),
    ('Volkswagen', 'Touareg'),
    ('Volkswagen', 'Tiguan Allspace'),
    ('Volkswagen', 'Amarok'),
    ('Volkswagen', 'Caddy'),
    ('Volkswagen', 'Transporter'),
    ('Volkswagen', 'Multivan'),
    ('Volkswagen', 'ID.3'),
    ('Volkswagen', 'ID.4'),
    ('Volkswagen', 'ID.5'),
    ('Volkswagen', 'ID. Buzz'),

    -- LEXUS
    ('Lexus', 'UX'),
    ('Lexus', 'GX'),
    ('Lexus', 'LX'),
    ('Lexus', 'LS'),
    ('Lexus', 'RC'),
    ('Lexus', 'LC'),
    ('Lexus', 'LBX'),
    ('Lexus', 'RZ'),
    ('Lexus', 'CT'),

    -- PORSCHE
    ('Porsche', '718 Boxster'),
    ('Porsche', '718 Cayman'),
    ('Porsche', 'Panamera'),
    ('Porsche', 'Taycan'),
    ('Porsche', 'Carrera GT'),
    ('Porsche', '918 Spyder'),

    -- LAND ROVER
    ('Land Rover', 'Defender'),
    ('Land Rover', 'Discovery'),
    ('Land Rover', 'Discovery Sport'),
    ('Land Rover', 'Range Rover'),
    ('Land Rover', 'Range Rover Sport'),
    ('Land Rover', 'Range Rover Evoque'),
    ('Land Rover', 'Range Rover Velar'),

    -- JAGUAR
    ('Jaguar', 'XE'),
    ('Jaguar', 'XF'),
    ('Jaguar', 'XJ'),
    ('Jaguar', 'F-Type'),
    ('Jaguar', 'F-Pace'),
    ('Jaguar', 'E-Pace'),
    ('Jaguar', 'I-Pace'),

    -- BYD
    ('BYD', 'Atto 3'),
    ('BYD', 'Dolphin'),
    ('BYD', 'Seal'),
    ('BYD', 'Sealion 6'),
    ('BYD', 'Sealion 7'),
    ('BYD', 'Shark 6'),
    ('BYD', 'Han'),
    ('BYD', 'Tang'),

    -- MG
    ('MG', 'MG3'),
    ('MG', 'MG4'),
    ('MG', 'MG5'),
    ('MG', 'ZS'),
    ('MG', 'HS'),
    ('MG', 'Cyberster'),

    -- GWM / HAVAL / TANK
    ('GWM', 'Cannon'),
    ('GWM', 'Cannon Alpha'),
    ('GWM', 'Poer'),
    ('Haval', 'H2'),
    ('Haval', 'H6'),
    ('Haval', 'Jolion'),
    ('Tank', '300'),
    ('Tank', '500'),

    -- TESLA
    ('Tesla', 'Model S'),
    ('Tesla', 'Model X'),
    ('Tesla', 'Cybertruck'),
    ('Tesla', 'Roadster'),

    -- POLESTAR
    ('Polestar', '1'),
    ('Polestar', '2'),
    ('Polestar', '3'),
    ('Polestar', '4'),
    ('Polestar', '5'),

    -- VOLVO
    ('Volvo', 'XC40'),
    ('Volvo', 'XC60'),
    ('Volvo', 'XC90'),
    ('Volvo', 'S60'),
    ('Volvo', 'S90'),
    ('Volvo', 'V60'),
    ('Volvo', 'V90'),
    ('Volvo', 'EX30'),
    ('Volvo', 'EX40'),
    ('Volvo', 'EX90'),

    -- PEUGEOT
    ('Peugeot', '208'),
    ('Peugeot', '308'),
    ('Peugeot', '408'),
    ('Peugeot', '2008'),
    ('Peugeot', '3008'),
    ('Peugeot', '5008'),
    ('Peugeot', 'Partner'),
    ('Peugeot', 'Expert'),

    -- SKODA
    ('Skoda', 'Fabia'),
    ('Skoda', 'Scala'),
    ('Skoda', 'Octavia'),
    ('Skoda', 'Superb'),
    ('Skoda', 'Kamiq'),
    ('Skoda', 'Karoq'),
    ('Skoda', 'Kodiaq'),
    ('Skoda', 'Enyaq'),

    -- HOLDEN
    ('Holden', 'Commodore'),
    ('Holden', 'Colorado'),
    ('Holden', 'Captiva'),
    ('Holden', 'Astra'),
    ('Holden', 'Barina'),
    ('Holden', 'Trax'),
    ('Holden', 'Trailblazer'),
    ('Holden', 'Acadia'),

    -- JEEP
    ('Jeep', 'Wrangler'),
    ('Jeep', 'Grand Cherokee'),
    ('Jeep', 'Cherokee'),
    ('Jeep', 'Compass'),
    ('Jeep', 'Renegade'),
    ('Jeep', 'Gladiator'),

    -- MINI
    ('Mini', 'Cooper'),
    ('Mini', 'Cooper S'),
    ('Mini', 'Countryman'),
    ('Mini', 'Clubman'),
    ('Mini', 'Paceman'),

    -- GENESIS
    ('Genesis', 'G70'),
    ('Genesis', 'G80'),
    ('Genesis', 'G90'),
    ('Genesis', 'GV60'),
    ('Genesis', 'GV70'),
    ('Genesis', 'GV80'),

    -- FERRARI
    ('Ferrari', '458'),
    ('Ferrari', '488'),
    ('Ferrari', 'F8 Tributo'),
    ('Ferrari', 'Roma'),
    ('Ferrari', 'Portofino'),
    ('Ferrari', '296'),
    ('Ferrari', 'SF90'),
    ('Ferrari', 'Purosangue'),
    ('Ferrari', '812 Superfast'),

    -- LAMBORGHINI
    ('Lamborghini', 'Gallardo'),
    ('Lamborghini', 'Huracan'),
    ('Lamborghini', 'Aventador'),
    ('Lamborghini', 'Revuelto'),
    ('Lamborghini', 'Urus'),
    ('Lamborghini', 'Temerario'),

    -- MASERATI
    ('Maserati', 'Ghibli'),
    ('Maserati', 'Quattroporte'),
    ('Maserati', 'Levante'),
    ('Maserati', 'Grecale'),
    ('Maserati', 'GranTurismo'),
    ('Maserati', 'MC20'),

    -- MCLAREN
    ('McLaren', '570S'),
    ('McLaren', '600LT'),
    ('McLaren', '650S'),
    ('McLaren', '720S'),
    ('McLaren', '750S'),
    ('McLaren', 'Artura'),
    ('McLaren', 'GT'),

    -- ASTON MARTIN
    ('Aston Martin', 'Vantage'),
    ('Aston Martin', 'DB11'),
    ('Aston Martin', 'DB12'),
    ('Aston Martin', 'DBX'),
    ('Aston Martin', 'Vanquish'),

    -- ROLLS-ROYCE
    ('Rolls-Royce', 'Ghost'),
    ('Rolls-Royce', 'Phantom'),
    ('Rolls-Royce', 'Cullinan'),
    ('Rolls-Royce', 'Wraith'),
    ('Rolls-Royce', 'Dawn'),
    ('Rolls-Royce', 'Spectre'),

    -- BENTLEY
    ('Bentley', 'Continental GT'),
    ('Bentley', 'Flying Spur'),
    ('Bentley', 'Bentayga'),
    ('Bentley', 'Mulsanne'),

    -- ISUZU
    ('Isuzu', 'D-Max'),
    ('Isuzu', 'MU-X'),
    ('Isuzu', 'N-Series'),

    -- LDV
    ('LDV', 'T60'),
    ('LDV', 'D90'),
    ('LDV', 'Deliver 9'),
    ('LDV', 'eDeliver 3'),
    ('LDV', 'eDeliver 9'),

    -- CHERY / OMODA / JAECOO
    ('Chery', 'Tiggo 4'),
    ('Chery', 'Tiggo 7'),
    ('Chery', 'Tiggo 8'),
    ('Omoda', 'C5'),
    ('Omoda', 'E5'),
    ('Omoda', '9'),
    ('Jaecoo', 'J7'),
    ('Jaecoo', 'J8'),

    -- CUPRA
    ('Cupra', 'Formentor'),
    ('Cupra', 'Leon'),
    ('Cupra', 'Ateca'),
    ('Cupra', 'Born'),
    ('Cupra', 'Tavascan'),

    -- RENAULT
    ('Renault', 'Clio'),
    ('Renault', 'Captur'),
    ('Renault', 'Arkana'),
    ('Renault', 'Koleos'),
    ('Renault', 'Megane'),
    ('Renault', 'Duster'),
    ('Renault', 'Kangoo'),

    -- FIAT
    ('Fiat', '500'),
    ('Fiat', '500e'),
    ('Fiat', 'Panda'),
    ('Fiat', 'Ducato'),

    -- ALFA ROMEO
    ('Alfa Romeo', 'Giulia'),
    ('Alfa Romeo', 'Stelvio'),
    ('Alfa Romeo', 'Tonale'),
    ('Alfa Romeo', '4C'),

    -- LUXURY ELECTRIC VEHICLES
    ('Rivian', 'R1T'),
    ('Rivian', 'R1S'),
    ('Lucid', 'Air'),
    ('Lucid', 'Gravity'),
    ('Zeekr', '001'),
    ('Zeekr', 'X'),
    ('Zeekr', '7X'),
    ('XPeng', 'G6'),
    ('XPeng', 'G9'),
    ('Nio', 'ET5'),
    ('Nio', 'ET7'),
    ('Nio', 'ES6'),

    -- ADDITIONAL NZ-RELEVANT BRANDS
    ('SsangYong', 'Rexton'),
    ('SsangYong', 'Korando'),
    ('SsangYong', 'Tivoli'),
    ('SsangYong', 'Musso'),
    ('KGM', 'Torres'),
    ('KGM', 'Musso'),
    ('Mahindra', 'Scorpio'),
    ('Mahindra', 'XUV700'),
    ('Mahindra', 'Pik-Up'),
    ('Daihatsu', 'Mira'),
    ('Daihatsu', 'Terios'),
    ('Daihatsu', 'Hijet'),
    ('Infiniti', 'Q50'),
    ('Infiniti', 'QX50'),
    ('Infiniti', 'QX80')
)

INSERT INTO vehicle_models (make_id, name)
SELECT
    m.id,
    c.model_name
FROM catalogue AS c
JOIN vehicle_makes AS m
    ON LOWER(m.name) = LOWER(c.make_name)
ON CONFLICT (make_id, name) DO NOTHING;

COMMIT;
