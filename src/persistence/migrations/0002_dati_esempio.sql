-- OMP-33 (issue #5): dati di esempio per sviluppo, test e dimostrazione.
--
-- Regole del dataset:
-- - chiavi esplicite (OVERRIDING SYSTEM VALUE) e sequenze allineate alla fine del file, così
--   dopo ogni reset i dati sono identici;
-- - istanti fissi con fuso orario e nessuna funzione dell'orologio: ultima_modifica è impostata
--   in modo esplicito invece di usare il valore predefinito;
-- - nessuna sosta in corso e nessuno stallo Non disponibile: tutte le soste sono Terminate, senza
--   dichiarazione né foto del permesso (NRF_LEG_2); le soste attive le creano simulatori e test;
-- - importi in centesimi; il saldo dei wallet risulta dai movimenti (vista saldo_wallet_virtuale);
-- - password: solo hash scrypt in formato PHC ($scrypt$ln=15,r=8,p=3$<sale>$<hash>, base64 senza
--   padding, chiave di 32 byte). Le credenziali dimostrative sono nel README, non qui;
-- - coordinate degli stalli: vie reali (OpenStreetMap), stalli distanziati di circa 5 m.
--
-- Gli id sono citati dalle specifiche dei test in docs/test/: non vanno cambiati.
-- La migrazione è immutabile: le correzioni vanno in una nuova migrazione.

-- Enti, tariffe, aree di sosta
INSERT INTO ente_preposto (id, nome) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Comune di Gragnano'),
  (2, 'Comune di Fisciano'),
  (3, 'Comune di Baronissi');

-- Gli orari di vigenza sono in ora locale italiana. T1 e T2: Gragnano; T3: Fisciano; T4: Baronissi.
INSERT INTO tariffa (id, costo_orario, orario_inizio_vigenza, orario_fine_vigenza, durata_massima)
OVERRIDING SYSTEM VALUE VALUES
  (1, 150, '08:00', '20:00', 180),
  (2, 100, '08:00', '20:00', 120),
  (3, 100, '08:00', '14:00', 120),
  (4,  80, '08:30', '13:30', 240);

INSERT INTO area_di_sosta (id, ente_preposto_id, nome) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'Via Tommaso Sorrentino'),
  (2, 1, 'Piazza San Leone'),
  (3, 1, 'Via Raffaele Viviani'),
  (4, 1, 'Via Roma'),
  (5, 1, 'Piazza Aubry'),
  (6, 2, 'Via Giovanni Paolo II'),
  (7, 2, 'Via Roma (Penta)'),
  (8, 3, 'Corso Giuseppe Garibaldi');

-- Stati Libero e Occupato con l'ultima rilevazione fissa al 15/11/2026 08:00; lo stallo 13 (n. 104)
-- è Sconosciuto con una rilevazione vecchia (SC_UT_4), lo stallo 25 non è mai stato rilevato.
INSERT INTO stallo (
  id, area_di_sosta_id, tariffa_id, numero, latitudine, longitudine, tipo_di_stallo, stato,
  occupazione_rilevata, data_e_ora_dell_ultima_rilevazione, ultima_modifica
) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 1, 40.689660, 14.52018, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (2, 1, 1, 2, 40.689710, 14.52018, 'DISABILI', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (3, 1, 1, 14, 40.689760, 14.52018, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (4, 2, 2, 1, 40.691730, 14.52307, 'ROSA', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (5, 2, 2, 8, 40.691780, 14.52307, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (6, 2, 2, 21, 40.691830, 14.52307, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (7, 3, 1, 3, 40.707790, 14.50338, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (8, 3, 1, 4, 40.707840, 14.50338, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (9, 3, 1, 5, 40.707890, 14.50338, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (10, 4, 1, 101, 40.691340, 14.51616, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (11, 4, 1, 102, 40.691390, 14.51616, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (12, 4, 1, 103, 40.691440, 14.51616, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (13, 4, 1, 104, 40.691490, 14.51616, 'ORDINARIO_A_PAGAMENTO', 'SCONOSCIUTO', 'VEICOLO_PRESENTE', '2026-11-15 07:00:00+01', '2026-11-15 08:00:00+01'),
  (14, 5, 1, 1, 40.688240, 14.52214, 'DISABILI', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (15, 5, 1, 2, 40.688290, 14.52214, 'ROSA', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (16, 5, 1, 3, 40.688340, 14.52214, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (17, 5, 1, 4, 40.688390, 14.52214, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (18, 5, 1, 5, 40.688440, 14.52214, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (19, 5, 1, 6, 40.688490, 14.52214, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (20, 5, 1, 7, 40.688540, 14.52214, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (21, 5, 1, 8, 40.688590, 14.52214, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (22, 6, 3, 1, 40.780410, 14.77065, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (23, 6, 3, 2, 40.780460, 14.77065, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (24, 6, 3, 3, 40.780510, 14.77065, 'DISABILI', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (25, 6, 3, 4, 40.780560, 14.77065, 'ROSA', 'SCONOSCIUTO', NULL, NULL, '2026-11-15 08:00:00+01'),
  (26, 7, 3, 1, 40.767390, 14.79723, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (27, 7, 3, 2, 40.767440, 14.79723, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (28, 8, 4, 1, 40.745740, 14.77057, 'ORDINARIO_A_PAGAMENTO', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (29, 8, 4, 2, 40.745790, 14.77057, 'ORDINARIO_A_PAGAMENTO', 'OCCUPATO', 'VEICOLO_PRESENTE', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01'),
  (30, 8, 4, 3, 40.745840, 14.77057, 'DISABILI', 'LIBERO', 'NESSUN_VEICOLO', '2026-11-15 08:00:00+01', '2026-11-15 08:00:00+01');

-- Utenti
INSERT INTO utente (id, email, hash_password, ruolo) OVERRIDING SYSTEM VALUE VALUES
  (1, 'marco.esposito@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$7K+1jcGOskp4QbMaZ7BNeA$cxxby3GUhPWxd3XunSnPOWaYfVKuDWPhh6RlyglPzIA',
   'AMMINISTRATORE'),
  (2, 'paolo.ferri@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$LL40MCLhuiEDaiVGhMVszA$UTqzbeKN6OQFuGA47sLheXxgY+IO6ukx1529O5fGbLY',
   'AUSILIARIO_DEL_TRAFFICO'),
  (3, 'sara.galli@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$d+UpxHKvWMbVBCX458X/sw$wPHwoRp47ae6rOCWMmS4u3N5qAGjZjrmpZg3EUjBDqU',
   'AUSILIARIO_DEL_TRAFFICO'),
  (4, 'luca.russo@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$nr4/08Qpebl9rLzQLtvEUg$WNU5nyEUWaaHTG22BRZpV8cX7GWu3WGGwpOY8DctcpI',
   'AUSILIARIO_DEL_TRAFFICO'),
  (5, 'anna.moretti@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$eEQ87O+fqxzI0twlvwo49A$cEQjvI/ZKKkY+nUx8dFkO5Gp4aXAQNm3FDDw4tZAJQI',
   'AUSILIARIO_DEL_TRAFFICO'),
  (6, 'giorgio.marino@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$/lsisVvtjqivKan/s5iOpg$fuqjp3k4Oic3T2ee/KTXCLYy3/i0nOGQaXKSuenI8r4',
   'AUSILIARIO_DEL_TRAFFICO'),
  (7, 'elena.bianchi@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$8ZM8+1INBPIwA8ue8ezfyQ$gwsSq7NNd+7BGWXeBk+hdfgzcQTiX+KqRHSKKNLnvy0',
   'AUTOMOBILISTA'),
  (8, 'marco.rossi@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$BlqazKCZttPPSCAdIXyGuw$6gYJaovZUajf+By6m9GQIIEI/VqUeTl9ZT8sznCbzIg',
   'AUTOMOBILISTA'),
  (9, 'luigi.verde@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$ZbuvorgQAp9KTRgfUrQhXw$4SuL0uzHFBruoLsiItYr/grVqz6wVEvBLBMEdG3A5UM',
   'AUTOMOBILISTA'),
  (10, 'giulia.romano@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$MspxPwNoCn+Pz7yQEttl4w$w/3R+ZNXHm/fg/cwSP7ag22JoT5TezMCDRl6xLJR7CA',
   'AUTOMOBILISTA'),
  (11, 'davide.conte@omnipark.example',
   '$scrypt$ln=15,r=8,p=3$fqx3SAU5ycxg+PfslK0kgQ$rYvwBrlDCfinD2oTUvVFvK7ljAtkWL3o5euFcenTS98',
   'AUTOMOBILISTA');

INSERT INTO amministratore (id, nome, cognome) VALUES
  (1, 'Marco', 'Esposito');

INSERT INTO ausiliario_del_traffico (id, nome, cognome, stato_dell_account, ente_preposto_id) VALUES
  (2, 'Paolo', 'Ferri', 'ATTIVO', 1),
  (3, 'Sara', 'Galli', 'ATTIVO', 1),
  (4, 'Luca', 'Russo', 'DISATTIVATO', 1),
  (5, 'Anna', 'Moretti', 'ATTIVO', 2),
  (6, 'Giorgio', 'Marino', 'ATTIVO', 3);

INSERT INTO gestione_account_ausiliario (amministratore_id, ausiliario_del_traffico_id) VALUES
  (1, 2), (1, 3), (1, 4), (1, 5), (1, 6);

INSERT INTO automobilista (id) VALUES (7), (8), (9), (10), (11);

-- Veicoli, wallet, preferiti
INSERT INTO veicolo (id, targa) OVERRIDING SYSTEM VALUE VALUES
  (1, 'EF456GH'),
  (2, 'GH321JK'),
  (3, 'MN234PQ'),
  (4, 'IJ789KL'),
  (5, 'CD330PL'),
  (6, 'AB123CD'),
  (7, 'FK771PS'),
  (8, 'EB917RT');

INSERT INTO automobilista_veicolo (automobilista_id, veicolo_id) VALUES
  (7, 1), (7, 2), (8, 3), (9, 4), (10, 5), (11, 6), (11, 7), (11, 8);

INSERT INTO wallet_virtuale (id, automobilista_id) OVERRIDING SYSTEM VALUE VALUES
  (1, 7), (2, 8), (3, 9), (4, 10), (5, 11);

INSERT INTO stallo_preferito (automobilista_id, stallo_id) VALUES (8, 11);
INSERT INTO area_di_sosta_preferita (automobilista_id, area_di_sosta_id) VALUES (10, 5);

-- Soste (tutte Terminate) e movimenti del wallet
INSERT INTO sosta (
  id, automobilista_id, veicolo_id, stallo_id, stato, orario_di_avvio, orario_di_scadenza, pagamento
) OVERRIDING SYSTEM VALUE VALUES
  (1, 8, 3, 10, 'TERMINATA', '2026-10-31 09:00:00+01', '2026-10-31 10:00:00+01', 'PAGATA'),
  (2, 8, 3, 11, 'TERMINATA', '2026-11-02 08:42:00+01', '2026-11-02 11:42:00+01', 'PAGATA'),
  (3, 9, 4, 14, 'TERMINATA', '2026-11-03 09:00:00+01', '2026-11-03 10:00:00+01', 'GRATUITA'),
  (4, 7, 1, 15, 'TERMINATA', '2026-11-04 10:00:00+01', '2026-11-04 11:00:00+01', 'PAGATA'),
  (5, 11, 8, 5, 'TERMINATA', '2026-11-06 15:04:00+01', '2026-11-06 16:04:00+01', 'PAGATA'),
  (6, 11, 6, 2, 'TERMINATA', '2026-11-05 11:10:00+01', '2026-11-05 12:10:00+01', 'GRATUITA'),
  (7, 10, 5, 6, 'TERMINATA', '2026-11-07 16:00:00+01', '2026-11-07 17:00:00+01', 'PAGATA'),
  (8, 11, 6, 9, 'TERMINATA', '2026-11-08 16:20:00+01', '2026-11-08 17:20:00+01', 'PAGATA'),
  (9, 8, 3, 11, 'TERMINATA', '2026-11-09 16:00:00+01', '2026-11-09 18:00:00+01', 'PAGATA'),
  (10, 7, 2, 22, 'TERMINATA', '2026-11-10 09:00:00+01', '2026-11-10 10:30:00+01', 'PAGATA');

-- Saldi risultanti: wallet 1 = 1700, 2 = 600, 3 = 500, 4 = 900, 5 = 1750 centesimi.
INSERT INTO movimento_del_wallet (id, wallet_virtuale_id, tipo_di_movimento, importo, data_e_ora, sosta_id)
OVERRIDING SYSTEM VALUE VALUES
  (1, 2, 'RICARICA', 500, '2026-10-31 08:30:00+01', NULL),
  (2, 2, 'ADDEBITO', 150, '2026-10-31 09:00:00+01', 1),
  (3, 2, 'ADDEBITO', 300, '2026-11-02 08:42:00+01', 2),
  (4, 2, 'RICARICA', 1000, '2026-11-02 10:18:00+01', NULL),
  (5, 2, 'ADDEBITO', 150, '2026-11-02 10:20:00+01', 2),
  (6, 2, 'ADDEBITO', 300, '2026-11-09 16:00:00+01', 9),
  (7, 1, 'RICARICA', 2000, '2026-11-01 09:00:00+01', NULL),
  (8, 1, 'ADDEBITO', 150, '2026-11-04 10:00:00+01', 4),
  (9, 1, 'ADDEBITO', 150, '2026-11-10 09:00:00+01', 10),
  (10, 3, 'RICARICA', 500, '2026-11-01 09:30:00+01', NULL),
  (11, 4, 'RICARICA', 1000, '2026-11-01 10:00:00+01', NULL),
  (12, 4, 'ADDEBITO', 100, '2026-11-07 16:00:00+01', 7),
  (13, 5, 'RICARICA', 2000, '2026-11-01 10:30:00+01', NULL),
  (14, 5, 'ADDEBITO', 100, '2026-11-06 15:04:00+01', 5),
  (15, 5, 'ADDEBITO', 150, '2026-11-08 16:20:00+01', 8);

-- Verifiche del permesso e segnalazioni
INSERT INTO verifica_del_permesso (id, sosta_id, ausiliario_del_traffico_id, esito, data_e_ora)
OVERRIDING SYSTEM VALUE VALUES
  (1, 4, 3, 'CONFORME', '2026-11-04 10:20:00+01'),
  (2, 6, 2, 'NON_CONFORME', '2026-11-05 11:30:00+01');

-- La segnalazione 6 nasce dalla verifica non conforme 2 (SC_OP_4): già chiusa, senza dati di lettura.
INSERT INTO segnalazione (
  id, stallo_id, ausiliario_del_traffico_id, verifica_del_permesso_id, stato, motivo, targa_rilevata,
  data_e_ora_della_lettura, data_e_ora_della_presa_in_carico, esito, data_e_ora_della_chiusura,
  ultima_modifica
) OVERRIDING SYSTEM VALUE VALUES
  (1, 3, 2, NULL, 'CHIUSA', 'SOSTA_ASSENTE', 'FG482KL',
   '2026-11-03 10:42:00+01', '2026-11-03 10:45:00+01', 'SOSTA_IRREGOLARE_ACCERTATA', '2026-11-03 11:00:00+01', '2026-11-15 08:00:00+01'),
  (2, 5, 4, NULL, 'CHIUSA', 'SOSTA_ASSENTE', 'TL220MC',
   '2026-11-02 11:00:00+01', '2026-11-02 11:05:00+01', 'NON_CONFERMATA', '2026-11-02 11:20:00+01', '2026-11-15 08:00:00+01'),
  (3, 4, 3, NULL, 'CHIUSA', 'SOSTA_ASSENTE', 'LM640TZ',
   '2026-11-03 22:30:00+01', '2026-11-04 08:05:00+01', 'NON_CONFERMATA', '2026-11-04 08:20:00+01', '2026-11-15 08:00:00+01'),
  (4, 7, 3, NULL, 'PRESA_IN_CARICO', 'SOSTA_ASSENTE', 'PB905LX',
   '2026-11-04 09:18:00+01', '2026-11-04 09:19:00+01', NULL, NULL, '2026-11-15 08:00:00+01'),
  (5, 8, 2, NULL, 'PRESA_IN_CARICO', 'SOSTA_ASSENTE', 'GA318BN',
   '2026-11-04 09:20:00+01', '2026-11-04 09:21:00+01', NULL, NULL, '2026-11-15 08:00:00+01'),
  (6, 2, 2, 2, 'CHIUSA', NULL, NULL,
   NULL, NULL, 'SOSTA_IRREGOLARE_ACCERTATA', '2026-11-05 11:30:00+01', '2026-11-15 08:00:00+01'),
  (7, 5, 2, NULL, 'CHIUSA', 'SOSTA_ASSENTE', 'EB917RT',
   '2026-11-06 15:01:00+01', '2026-11-06 15:03:00+01', 'NON_CONFERMATA', '2026-11-06 15:06:00+01', '2026-11-15 08:00:00+01'),
  (8, 6, 2, NULL, 'CHIUSA', 'SOSTA_SCADUTA', 'CD330PL',
   '2026-11-07 17:10:00+01', '2026-11-07 17:20:00+01', 'NON_CONFERMATA', '2026-11-07 17:35:00+01', '2026-11-15 08:00:00+01'),
  (9, 9, 2, NULL, 'CHIUSA', 'TARGA_NON_CORRISPONDENTE', 'FK771PS',
   '2026-11-08 16:25:00+01', '2026-11-08 16:30:00+01', 'SOSTA_IRREGOLARE_ACCERTATA', '2026-11-08 16:45:00+01', '2026-11-15 08:00:00+01'),
  (10, 18, 3, NULL, 'PRESA_IN_CARICO', 'SOSTA_ASSENTE', 'RS447TV',
   '2026-11-10 09:30:00+01', '2026-11-10 09:40:00+01', NULL, NULL, '2026-11-15 08:00:00+01'),
  (11, 3, NULL, NULL, 'APERTA', 'SOSTA_ASSENTE', 'HB204KM',
   '2026-11-10 10:00:00+01', NULL, NULL, NULL, '2026-11-15 08:00:00+01'),
  (12, 23, NULL, NULL, 'APERTA', 'SOSTA_ASSENTE', 'KC562DF',
   '2026-11-10 11:00:00+01', NULL, NULL, NULL, '2026-11-15 08:00:00+01');

-- Sequenze allineate alle chiavi esplicite
SELECT setval(pg_get_serial_sequence('ente_preposto', 'id'), (SELECT max(id) FROM ente_preposto));
SELECT setval(pg_get_serial_sequence('tariffa', 'id'), (SELECT max(id) FROM tariffa));
SELECT setval(pg_get_serial_sequence('area_di_sosta', 'id'), (SELECT max(id) FROM area_di_sosta));
SELECT setval(pg_get_serial_sequence('stallo', 'id'), (SELECT max(id) FROM stallo));
SELECT setval(pg_get_serial_sequence('utente', 'id'), (SELECT max(id) FROM utente));
SELECT setval(pg_get_serial_sequence('veicolo', 'id'), (SELECT max(id) FROM veicolo));
SELECT setval(pg_get_serial_sequence('wallet_virtuale', 'id'), (SELECT max(id) FROM wallet_virtuale));
SELECT setval(pg_get_serial_sequence('sosta', 'id'), (SELECT max(id) FROM sosta));
SELECT setval(pg_get_serial_sequence('movimento_del_wallet', 'id'), (SELECT max(id) FROM movimento_del_wallet));
SELECT setval(pg_get_serial_sequence('verifica_del_permesso', 'id'), (SELECT max(id) FROM verifica_del_permesso));
SELECT setval(pg_get_serial_sequence('segnalazione', 'id'), (SELECT max(id) FROM segnalazione));
