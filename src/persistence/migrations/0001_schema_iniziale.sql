-- OMP-32 (COD-04): schema iniziale derivato dal Class Diagram d'analisi v6.1
-- (docs/rad/class_analisi.puml) e dai vincoli di docs/rad/vincoli_dominio.md.
--
-- Convenzioni:
-- - tabelle e colonne con il nome della classe o dell'attributo del CD in snake_case;
-- - chiavi primarie surrogate; chiavi esterne <tabella>_id;
-- - enumerazioni come text con CHECK sui valori del CD;
-- - istanti in timestamptz, importi in centesimi interi, durate in minuti;
-- - ON DELETE RESTRICT per tutto ciò che fa storico, compresa la gestione degli account degli
--   ausiliari; CASCADE solo per le righe che non hanno senso senza il proprietario (sottotipi,
--   sessioni, targhe del profilo, preferiti).
--
-- La migrazione è eseguita in una transazione dall'esecutore: il file non la apre né la chiude.

-- ============================================================================================
-- Funzioni dei trigger
-- ============================================================================================

-- Aggiorna ultima_modifica quando la riga cambia davvero: serve alla mappa (NRF_PER_3) per
-- leggere solo stalli e segnalazioni modificati.
CREATE FUNCTION aggiorna_ultima_modifica() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.ultima_modifica := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Il pagamento della sosta è la fotografia scritta all'avvio e non cambia più.
CREATE FUNCTION impedisci_modifica_pagamento() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pagamento IS DISTINCT FROM OLD.pagamento THEN
    RAISE EXCEPTION 'Il pagamento della sosta % non si può modificare dopo l''avvio', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Vale il primo esito registrato (vincolo 12): la verifica non si modifica dopo la registrazione.
CREATE FUNCTION impedisci_modifica_verifica() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.esito IS DISTINCT FROM OLD.esito
    OR NEW.data_e_ora IS DISTINCT FROM OLD.data_e_ora
    OR NEW.sosta_id IS DISTINCT FROM OLD.sosta_id
    OR NEW.ausiliario_del_traffico_id IS DISTINCT FROM OLD.ausiliario_del_traffico_id THEN
    RAISE EXCEPTION 'La verifica del permesso % è già registrata e non si può modificare', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Una segnalazione nasce da una verifica del permesso solo se l'esito è non conforme
-- (vincolo 13). Una verifica inesistente la rifiuta la chiave esterna.
CREATE FUNCTION impedisci_segnalazione_da_verifica_conforme() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.verifica_del_permesso_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM verifica_del_permesso
    WHERE id = NEW.verifica_del_permesso_id AND esito <> 'NON_CONFORME'
  ) THEN
    RAISE EXCEPTION 'La segnalazione può nascere solo da una verifica del permesso non conforme'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================================
-- Enti, aree, tariffe, stalli
-- ============================================================================================

CREATE TABLE ente_preposto (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text   NOT NULL CONSTRAINT ente_preposto_nome_non_vuoto CHECK (btrim(nome) <> ''),
  CONSTRAINT ente_preposto_nome_unico UNIQUE (nome)
);
COMMENT ON TABLE ente_preposto IS 'CD: Ente preposto.';

CREATE TABLE area_di_sosta (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ente_preposto_id bigint NOT NULL REFERENCES ente_preposto (id) ON DELETE RESTRICT,
  nome             text   NOT NULL CONSTRAINT area_di_sosta_nome_non_vuoto CHECK (btrim(nome) <> ''),
  CONSTRAINT area_di_sosta_nome_unico_per_ente UNIQUE (ente_preposto_id, nome)
);
COMMENT ON TABLE area_di_sosta IS 'CD: Area di sosta (associazione «è di competenza di» verso Ente preposto).';

CREATE TABLE tariffa (
  id                    bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  costo_orario          integer NOT NULL CONSTRAINT tariffa_costo_orario_positivo CHECK (costo_orario > 0),
  orario_inizio_vigenza time    NOT NULL,
  orario_fine_vigenza   time    NOT NULL,
  durata_massima        integer NOT NULL CONSTRAINT tariffa_durata_massima_positiva CHECK (durata_massima > 0),
  CONSTRAINT tariffa_vigenza_ordinata CHECK (orario_inizio_vigenza < orario_fine_vigenza)
);
COMMENT ON TABLE tariffa IS 'CD: Tariffa. Gli orari di vigenza sono uguali tutti i giorni.';
COMMENT ON COLUMN tariffa.costo_orario IS 'Costo orario in centesimi di euro.';
COMMENT ON COLUMN tariffa.orario_inizio_vigenza IS
  'Inizio della fascia a pagamento, ora locale italiana (Europe/Rome). Il servizio che calcola '
  'l''importo converte gli istanti timestamptz in ora locale prima del confronto.';
COMMENT ON COLUMN tariffa.orario_fine_vigenza IS
  'Fine della fascia a pagamento, ora locale italiana (Europe/Rome). Il servizio che calcola '
  'l''importo converte gli istanti timestamptz in ora locale prima del confronto.';
COMMENT ON COLUMN tariffa.durata_massima IS 'Durata massima della sosta in minuti.';

CREATE TABLE stallo (
  id                                 bigint           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  area_di_sosta_id                   bigint           NOT NULL REFERENCES area_di_sosta (id) ON DELETE RESTRICT,
  tariffa_id                         bigint           NOT NULL REFERENCES tariffa (id) ON DELETE RESTRICT,
  numero                             integer          NOT NULL CONSTRAINT stallo_numero_positivo CHECK (numero > 0),
  latitudine                         double precision NOT NULL CONSTRAINT stallo_latitudine_valida CHECK (latitudine BETWEEN -90 AND 90),
  longitudine                        double precision NOT NULL CONSTRAINT stallo_longitudine_valida CHECK (longitudine BETWEEN -180 AND 180),
  tipo_di_stallo                     text             NOT NULL CONSTRAINT stallo_tipo_di_stallo_ammesso
    CHECK (tipo_di_stallo IN ('ORDINARIO_A_PAGAMENTO', 'DISABILI', 'ROSA')),
  stato                              text             NOT NULL DEFAULT 'SCONOSCIUTO' CONSTRAINT stallo_stato_ammesso
    CHECK (stato IN ('LIBERO', 'OCCUPATO', 'NON_DISPONIBILE', 'SCONOSCIUTO')),
  occupazione_rilevata               text             CONSTRAINT stallo_occupazione_rilevata_ammessa
    CHECK (occupazione_rilevata IN ('VEICOLO_PRESENTE', 'NESSUN_VEICOLO')),
  data_e_ora_dell_ultima_rilevazione timestamptz,
  ultima_modifica                    timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT stallo_numero_unico_per_area UNIQUE (area_di_sosta_id, numero),
  -- L'ultima rilevazione ha sempre entrambi i dati; manca solo prima della prima rilevazione,
  -- quando lo stallo è nello stato iniziale Sconosciuto (SCD_1).
  CONSTRAINT stallo_rilevazione_completa
    CHECK ((occupazione_rilevata IS NULL) = (data_e_ora_dell_ultima_rilevazione IS NULL)),
  CONSTRAINT stallo_senza_rilevazione_sconosciuto
    CHECK (occupazione_rilevata IS NOT NULL OR stato = 'SCONOSCIUTO'),
  -- Guardie di SCD_1: Libero e Occupato riflettono l'ultima rilevazione; Non disponibile e
  -- Sconosciuto conservano qualsiasi rilevazione (vincolo 20).
  CONSTRAINT stallo_libero_senza_veicolo
    CHECK (stato <> 'LIBERO' OR occupazione_rilevata = 'NESSUN_VEICOLO'),
  CONSTRAINT stallo_occupato_con_veicolo
    CHECK (stato <> 'OCCUPATO' OR occupazione_rilevata = 'VEICOLO_PRESENTE')
);
COMMENT ON TABLE stallo IS
  'CD: Stallo (associazioni «appartiene a» verso Area di sosta e «si applica a» da Tariffa).';
COMMENT ON COLUMN stallo.latitudine IS 'CD: posizione (latitudine, gradi decimali).';
COMMENT ON COLUMN stallo.longitudine IS 'CD: posizione (longitudine, gradi decimali).';
COMMENT ON COLUMN stallo.occupazione_rilevata IS
  'Ultima rilevazione del sensore. NULL solo prima della prima rilevazione (stato SCONOSCIUTO).';
COMMENT ON COLUMN stallo.ultima_modifica IS
  'Colonna tecnica aggiornata da trigger: individua gli stalli cambiati per la mappa.';

CREATE INDEX stallo_tariffa_idx ON stallo (tariffa_id);
CREATE INDEX stallo_ultima_modifica_idx ON stallo (ultima_modifica);

CREATE TRIGGER stallo_aggiorna_ultima_modifica
  BEFORE UPDATE ON stallo
  FOR EACH ROW EXECUTE FUNCTION aggiorna_ultima_modifica();

-- ============================================================================================
-- Utenti: tabella comune e una tabella per ruolo ({complete, disjoint})
-- ============================================================================================

CREATE TABLE utente (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text   NOT NULL CONSTRAINT utente_email_formato
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  hash_password text   NOT NULL CONSTRAINT utente_hash_password_non_vuoto CHECK (hash_password <> ''),
  ruolo         text   NOT NULL CONSTRAINT utente_ruolo_ammesso
    CHECK (ruolo IN ('AUTOMOBILISTA', 'AUSILIARIO_DEL_TRAFFICO', 'AMMINISTRATORE')),
  -- Bersaglio delle chiavi esterne (id, ruolo) delle sottoclassi: ogni utente ha al più un sottotipo.
  CONSTRAINT utente_id_ruolo_unico UNIQUE (id, ruolo)
);
COMMENT ON TABLE utente IS 'CD: Utente (classe astratta). Dati di accesso comuni a tutti i ruoli.';
COMMENT ON COLUMN utente.hash_password IS 'CD: password. Si conserva solo l''hash, mai la password in chiaro.';
COMMENT ON COLUMN utente.ruolo IS
  'Colonna tecnica: ruolo dell''utente, vincola la disgiunzione della generalizzazione.';

-- Email unica senza distinzione tra maiuscole e minuscole (vincolo 1).
CREATE UNIQUE INDEX utente_email_unica ON utente (lower(email));

CREATE TABLE automobilista (
  id    bigint PRIMARY KEY,
  ruolo text   NOT NULL DEFAULT 'AUTOMOBILISTA'
    CONSTRAINT automobilista_ruolo CHECK (ruolo = 'AUTOMOBILISTA'),
  CONSTRAINT automobilista_utente_fk
    FOREIGN KEY (id, ruolo) REFERENCES utente (id, ruolo) ON DELETE CASCADE
);
COMMENT ON TABLE automobilista IS
  'CD: Automobilista. Nessun attributo proprio; riferimento di wallet, soste, veicoli e preferiti. '
  'Nessun dato sui permessi (NRF_LEG_2).';

CREATE TABLE amministratore (
  id      bigint PRIMARY KEY,
  ruolo   text   NOT NULL DEFAULT 'AMMINISTRATORE'
    CONSTRAINT amministratore_ruolo CHECK (ruolo = 'AMMINISTRATORE'),
  nome    text   NOT NULL CONSTRAINT amministratore_nome_non_vuoto CHECK (btrim(nome) <> ''),
  cognome text   NOT NULL CONSTRAINT amministratore_cognome_non_vuoto CHECK (btrim(cognome) <> ''),
  CONSTRAINT amministratore_utente_fk
    FOREIGN KEY (id, ruolo) REFERENCES utente (id, ruolo) ON DELETE CASCADE
);
COMMENT ON TABLE amministratore IS 'CD: Amministratore («nome e cognome» in due colonne).';

CREATE TABLE ausiliario_del_traffico (
  id                 bigint PRIMARY KEY,
  ruolo              text   NOT NULL DEFAULT 'AUSILIARIO_DEL_TRAFFICO'
    CONSTRAINT ausiliario_del_traffico_ruolo CHECK (ruolo = 'AUSILIARIO_DEL_TRAFFICO'),
  nome               text   NOT NULL CONSTRAINT ausiliario_del_traffico_nome_non_vuoto CHECK (btrim(nome) <> ''),
  cognome            text   NOT NULL CONSTRAINT ausiliario_del_traffico_cognome_non_vuoto CHECK (btrim(cognome) <> ''),
  stato_dell_account text   NOT NULL DEFAULT 'ATTIVO'
    CONSTRAINT ausiliario_del_traffico_stato_dell_account_ammesso
    CHECK (stato_dell_account IN ('ATTIVO', 'DISATTIVATO')),
  ente_preposto_id   bigint NOT NULL REFERENCES ente_preposto (id) ON DELETE RESTRICT,
  CONSTRAINT ausiliario_del_traffico_utente_fk
    FOREIGN KEY (id, ruolo) REFERENCES utente (id, ruolo) ON DELETE CASCADE
);
COMMENT ON TABLE ausiliario_del_traffico IS
  'CD: Ausiliario del Traffico (associazione «opera per» verso Ente preposto). '
  'Si disattiva invece di cancellarlo (vincolo 19): segnalazioni e verifiche restano associate.';

CREATE INDEX ausiliario_del_traffico_ente_preposto_idx ON ausiliario_del_traffico (ente_preposto_id);

-- Associazione «gestisce l'account di» (Amministratore 1..* — 0..* Ausiliario del Traffico).
CREATE TABLE gestione_account_ausiliario (
  amministratore_id          bigint NOT NULL REFERENCES amministratore (id) ON DELETE RESTRICT,
  ausiliario_del_traffico_id bigint NOT NULL REFERENCES ausiliario_del_traffico (id) ON DELETE RESTRICT,
  PRIMARY KEY (amministratore_id, ausiliario_del_traffico_id)
);
COMMENT ON TABLE gestione_account_ausiliario IS
  'CD: associazione «gestisce l''account di» tra Amministratore e Ausiliario del Traffico.';

CREATE INDEX gestione_account_ausiliario_ausiliario_idx
  ON gestione_account_ausiliario (ausiliario_del_traffico_id);

-- Tabella tecnica delle sessioni (RF_AUTH_4: l'uscita elimina la riga; vincolo 19: alla
-- disattivazione si eliminano le sessioni dell'ausiliario).
CREATE TABLE sessione (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  utente_id  bigint      NOT NULL REFERENCES utente (id) ON DELETE CASCADE,
  hash_token char(64)    NOT NULL CONSTRAINT sessione_hash_token_formato
    CHECK (hash_token ~ '^[0-9a-f]{64}$'),
  scadenza   timestamptz NOT NULL,
  CONSTRAINT sessione_hash_token_unico UNIQUE (hash_token)
);
COMMENT ON TABLE sessione IS
  'Tabella tecnica, non nel CD. Si conserva solo l''hash sha256 del token, mai il token in chiaro.';

CREATE INDEX sessione_utente_idx ON sessione (utente_id);

-- ============================================================================================
-- Veicoli, wallet, preferiti
-- ============================================================================================

CREATE TABLE veicolo (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Forma normalizzata (maiuscole, senza spazi né trattini): rende l'unicità significativa.
  -- La validità formale della targa la verifica il servizio (UC_AUTH_5).
  targa text   NOT NULL CONSTRAINT veicolo_targa_normalizzata CHECK (targa ~ '^[A-Z0-9]+$'),
  CONSTRAINT veicolo_targa_unica UNIQUE (targa)
);
COMMENT ON TABLE veicolo IS 'CD: Veicolo. La stessa targa può stare nel profilo di più automobilisti.';

-- Associazione «associa» (Automobilista 1..* — 1..* Veicolo).
CREATE TABLE automobilista_veicolo (
  automobilista_id bigint NOT NULL REFERENCES automobilista (id) ON DELETE CASCADE,
  veicolo_id       bigint NOT NULL REFERENCES veicolo (id) ON DELETE RESTRICT,
  PRIMARY KEY (automobilista_id, veicolo_id)
);
COMMENT ON TABLE automobilista_veicolo IS
  'CD: associazione «associa» tra Automobilista e Veicolo (targhe del profilo).';

CREATE INDEX automobilista_veicolo_veicolo_idx ON automobilista_veicolo (veicolo_id);

CREATE TABLE wallet_virtuale (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  automobilista_id bigint NOT NULL REFERENCES automobilista (id) ON DELETE RESTRICT,
  CONSTRAINT wallet_virtuale_uno_per_automobilista UNIQUE (automobilista_id)
);
COMMENT ON TABLE wallet_virtuale IS
  'CD: Wallet virtuale (associazione «possiede», 1–1). Il saldo non si memorizza: '
  'lo calcola la vista saldo_wallet_virtuale.';

-- Associazione «salva tra i preferiti» (Automobilista 0..* — 0..* Stallo).
CREATE TABLE stallo_preferito (
  automobilista_id bigint NOT NULL REFERENCES automobilista (id) ON DELETE CASCADE,
  stallo_id        bigint NOT NULL REFERENCES stallo (id) ON DELETE CASCADE,
  PRIMARY KEY (automobilista_id, stallo_id)
);
COMMENT ON TABLE stallo_preferito IS
  'CD: associazione «salva tra i preferiti» tra Automobilista e Stallo.';

CREATE INDEX stallo_preferito_stallo_idx ON stallo_preferito (stallo_id);

-- Associazione «salva tra i preferiti» (Automobilista 0..* — 0..* Area di sosta).
CREATE TABLE area_di_sosta_preferita (
  automobilista_id bigint NOT NULL REFERENCES automobilista (id) ON DELETE CASCADE,
  area_di_sosta_id bigint NOT NULL REFERENCES area_di_sosta (id) ON DELETE CASCADE,
  PRIMARY KEY (automobilista_id, area_di_sosta_id)
);
COMMENT ON TABLE area_di_sosta_preferita IS
  'CD: associazione «salva tra i preferiti» tra Automobilista e Area di sosta.';

CREATE INDEX area_di_sosta_preferita_area_idx ON area_di_sosta_preferita (area_di_sosta_id);

-- ============================================================================================
-- Soste e movimenti del wallet
-- ============================================================================================

CREATE TABLE sosta (
  id                        bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  automobilista_id          bigint      NOT NULL REFERENCES automobilista (id) ON DELETE RESTRICT,
  veicolo_id                bigint      NOT NULL REFERENCES veicolo (id) ON DELETE RESTRICT,
  stallo_id                 bigint      NOT NULL REFERENCES stallo (id) ON DELETE RESTRICT,
  stato                     text        NOT NULL CONSTRAINT sosta_stato_ammesso
    CHECK (stato IN ('ATTIVA', 'SCADUTA', 'TERMINATA')),
  orario_di_avvio           timestamptz NOT NULL,
  orario_di_scadenza        timestamptz NOT NULL,
  pagamento                 text        NOT NULL CONSTRAINT sosta_pagamento_ammesso
    CHECK (pagamento IN ('PAGATA', 'GRATUITA')),
  dichiarazione_di_permesso text        CONSTRAINT sosta_dichiarazione_non_vuota
    CHECK (btrim(dichiarazione_di_permesso) <> ''),
  foto_del_permesso         bytea       CONSTRAINT sosta_foto_dimensione
    CHECK (octet_length(foto_del_permesso) BETWEEN 1 AND 2097152),
  CONSTRAINT sosta_scadenza_dopo_avvio CHECK (orario_di_scadenza > orario_di_avvio),
  -- Dichiarazione e foto del permesso sono entrambe presenti o entrambe assenti (vincolo 8).
  CONSTRAINT sosta_permesso_completo
    CHECK ((dichiarazione_di_permesso IS NULL) = (foto_del_permesso IS NULL)),
  -- Al termine della sosta dichiarazione e foto sono eliminate (vincolo 11, NRF_LEG_2).
  CONSTRAINT sosta_permesso_eliminato_al_termine
    CHECK (stato <> 'TERMINATA' OR (dichiarazione_di_permesso IS NULL AND foto_del_permesso IS NULL)),
  -- Una sosta gratuita ha dichiarazione e foto del permesso finché non termina (/pagamento).
  CONSTRAINT sosta_gratuita_con_permesso
    CHECK (pagamento <> 'GRATUITA' OR stato = 'TERMINATA' OR dichiarazione_di_permesso IS NOT NULL)
);
COMMENT ON TABLE sosta IS
  'CD: Sosta (associazioni «avvia», «è avviata per», «si svolge in»).';
COMMENT ON COLUMN sosta.pagamento IS
  'CD: /pagamento. Fotografia scritta all''avvio e immutabile (trigger), così lo storico non '
  'cambia se cambia il tipo dello stallo. Gli importi pagati sono nei movimenti del wallet.';
COMMENT ON COLUMN sosta.dichiarazione_di_permesso IS
  'Testo della dichiarazione di esporre il permesso. Eliminata al termine della sosta (NRF_LEG_2).';
COMMENT ON COLUMN sosta.foto_del_permesso IS
  'Foto del permesso esposto, al massimo 2 MB. Eliminata al termine della sosta (NRF_LEG_2).';

-- Al massimo una sosta attiva per veicolo (vincolo 2) e per stallo.
CREATE UNIQUE INDEX sosta_una_attiva_per_veicolo ON sosta (veicolo_id) WHERE stato = 'ATTIVA';
CREATE UNIQUE INDEX sosta_una_attiva_per_stallo ON sosta (stallo_id) WHERE stato = 'ATTIVA';

CREATE INDEX sosta_automobilista_idx ON sosta (automobilista_id);
CREATE INDEX sosta_veicolo_idx ON sosta (veicolo_id);
CREATE INDEX sosta_stallo_idx ON sosta (stallo_id);
CREATE INDEX sosta_attiva_scadenza_idx ON sosta (orario_di_scadenza) WHERE stato = 'ATTIVA';

CREATE TRIGGER sosta_pagamento_immutabile
  BEFORE UPDATE OF pagamento ON sosta
  FOR EACH ROW EXECUTE FUNCTION impedisci_modifica_pagamento();

CREATE TABLE movimento_del_wallet (
  id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_virtuale_id bigint      NOT NULL REFERENCES wallet_virtuale (id) ON DELETE RESTRICT,
  tipo_di_movimento  text        NOT NULL CONSTRAINT movimento_del_wallet_tipo_ammesso
    CHECK (tipo_di_movimento IN ('RICARICA', 'ADDEBITO')),
  importo            integer     NOT NULL CONSTRAINT movimento_del_wallet_importo_positivo
    CHECK (importo > 0),
  data_e_ora         timestamptz NOT NULL,
  sosta_id           bigint      REFERENCES sosta (id) ON DELETE RESTRICT,
  -- Una ricarica non è collegata ad alcuna sosta; un addebito a una sola (vincolo 4).
  CONSTRAINT movimento_del_wallet_sosta_coerente_con_tipo CHECK (
    (tipo_di_movimento = 'RICARICA' AND sosta_id IS NULL)
    OR (tipo_di_movimento = 'ADDEBITO' AND sosta_id IS NOT NULL)
  )
);
COMMENT ON TABLE movimento_del_wallet IS
  'CD: Movimento del wallet (associazioni «registra» e «è addebitato per»).';
COMMENT ON COLUMN movimento_del_wallet.importo IS
  'Importo in centesimi di euro, sempre positivo: il segno lo dà il tipo di movimento.';

CREATE INDEX movimento_del_wallet_cronologia_idx ON movimento_del_wallet (wallet_virtuale_id, data_e_ora);
CREATE INDEX movimento_del_wallet_sosta_idx ON movimento_del_wallet (sosta_id);

-- Attributo derivato /saldo del Wallet virtuale: ricariche meno addebiti, in centesimi.
CREATE VIEW saldo_wallet_virtuale AS
SELECT
  w.id AS wallet_virtuale_id,
  w.automobilista_id,
  COALESCE(
    SUM(
      CASE m.tipo_di_movimento
        WHEN 'RICARICA' THEN m.importo
        WHEN 'ADDEBITO' THEN -m.importo
      END
    ),
    0
  )::bigint AS saldo
FROM wallet_virtuale AS w
LEFT JOIN movimento_del_wallet AS m ON m.wallet_virtuale_id = w.id
GROUP BY w.id;
COMMENT ON VIEW saldo_wallet_virtuale IS
  'CD: Wallet virtuale./saldo, calcolato dai movimenti (centesimi di euro).';

-- ============================================================================================
-- Verifiche del permesso e segnalazioni
-- ============================================================================================

CREATE TABLE verifica_del_permesso (
  id                         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sosta_id                   bigint      NOT NULL REFERENCES sosta (id) ON DELETE RESTRICT,
  ausiliario_del_traffico_id bigint      NOT NULL REFERENCES ausiliario_del_traffico (id) ON DELETE RESTRICT,
  esito                      text        NOT NULL CONSTRAINT verifica_del_permesso_esito_ammesso
    CHECK (esito IN ('CONFORME', 'NON_CONFORME')),
  data_e_ora                 timestamptz NOT NULL,
  -- Al più una verifica per sosta: vale il primo esito registrato (vincolo 12).
  CONSTRAINT verifica_del_permesso_una_per_sosta UNIQUE (sosta_id),
  -- Bersaglio della chiave esterna composta di segnalazione (vincolo 13).
  CONSTRAINT verifica_del_permesso_id_ausiliario_unico UNIQUE (id, ausiliario_del_traffico_id)
);
COMMENT ON TABLE verifica_del_permesso IS
  'CD: Verifica del permesso (associazioni «controlla» e «è registrata da»).';

CREATE INDEX verifica_del_permesso_ausiliario_idx ON verifica_del_permesso (ausiliario_del_traffico_id);

CREATE TRIGGER verifica_del_permesso_immutabile
  BEFORE UPDATE OF esito, data_e_ora, sosta_id, ausiliario_del_traffico_id ON verifica_del_permesso
  FOR EACH ROW EXECUTE FUNCTION impedisci_modifica_verifica();

CREATE TABLE segnalazione (
  id                               bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stallo_id                        bigint      NOT NULL REFERENCES stallo (id) ON DELETE RESTRICT,
  ausiliario_del_traffico_id       bigint      REFERENCES ausiliario_del_traffico (id) ON DELETE RESTRICT,
  verifica_del_permesso_id         bigint      REFERENCES verifica_del_permesso (id) ON DELETE RESTRICT,
  stato                            text        NOT NULL CONSTRAINT segnalazione_stato_ammesso
    CHECK (stato IN ('APERTA', 'PRESA_IN_CARICO', 'CHIUSA')),
  motivo                           text        CONSTRAINT segnalazione_motivo_ammesso
    CHECK (motivo IN ('SOSTA_ASSENTE', 'SOSTA_SCADUTA', 'TARGA_NON_CORRISPONDENTE')),
  targa_rilevata                   text        CONSTRAINT segnalazione_targa_rilevata_normalizzata
    CHECK (targa_rilevata ~ '^[A-Z0-9]+$'),
  data_e_ora_della_lettura         timestamptz,
  data_e_ora_della_presa_in_carico timestamptz,
  esito                            text        CONSTRAINT segnalazione_esito_ammesso
    CHECK (esito IN ('SOSTA_IRREGOLARE_ACCERTATA', 'NON_CONFERMATA')),
  data_e_ora_della_chiusura        timestamptz,
  ultima_modifica                  timestamptz NOT NULL DEFAULT now(),
  -- Associazione «genera»: al più una segnalazione per verifica.
  CONSTRAINT segnalazione_una_per_verifica UNIQUE (verifica_del_permesso_id),
  -- La segnalazione generata da una verifica è assegnata a chi l'ha registrata (vincolo 13).
  CONSTRAINT segnalazione_assegnata_a_chi_ha_verificato
    FOREIGN KEY (verifica_del_permesso_id, ausiliario_del_traffico_id)
    REFERENCES verifica_del_permesso (id, ausiliario_del_traffico_id) ON DELETE RESTRICT,
  -- Origine (vincolo 13): da lettura ANPR, con motivo, targa e data della lettura, oppure da
  -- una verifica non conforme, senza dati della lettura.
  CONSTRAINT segnalazione_dati_lettura_completi CHECK (
    (motivo IS NULL AND targa_rilevata IS NULL AND data_e_ora_della_lettura IS NULL)
    OR (motivo IS NOT NULL AND targa_rilevata IS NOT NULL AND data_e_ora_della_lettura IS NOT NULL)
  ),
  CONSTRAINT segnalazione_una_origine
    CHECK ((verifica_del_permesso_id IS NULL) = (motivo IS NOT NULL)),
  -- Da verifica non conforme nasce già Chiusa con esito accertato, senza presa in carico (SCD_3).
  CONSTRAINT segnalazione_da_verifica_chiusa_accertata CHECK (
    verifica_del_permesso_id IS NULL
    OR (
      stato = 'CHIUSA'
      AND esito = 'SOSTA_IRREGOLARE_ACCERTATA'
      AND data_e_ora_della_presa_in_carico IS NULL
    )
  ),
  -- Aperta: non assegnata; Presa in carico o Chiusa: assegnata a un ausiliario (vincolo 17).
  CONSTRAINT segnalazione_assegnazione
    CHECK ((stato = 'APERTA') = (ausiliario_del_traffico_id IS NULL)),
  -- Presa in carico con la sua data; un'Aperta non ha data di presa in carico (SCD_3).
  CONSTRAINT segnalazione_presa_in_carico_con_data CHECK (
    (stato <> 'APERTA' OR data_e_ora_della_presa_in_carico IS NULL)
    AND (stato <> 'PRESA_IN_CARICO' OR data_e_ora_della_presa_in_carico IS NOT NULL)
  ),
  -- Chiusura con esito e data, e solo nello stato Chiusa (SCD_3).
  CONSTRAINT segnalazione_chiusura_con_esito_e_data CHECK (
    (stato = 'CHIUSA') = (esito IS NOT NULL)
    AND (stato = 'CHIUSA') = (data_e_ora_della_chiusura IS NOT NULL)
  ),
  CONSTRAINT segnalazione_date_ordinate CHECK (
    data_e_ora_della_presa_in_carico >= data_e_ora_della_lettura
    AND data_e_ora_della_chiusura >= data_e_ora_della_presa_in_carico
    AND data_e_ora_della_chiusura >= data_e_ora_della_lettura
  )
);
COMMENT ON TABLE segnalazione IS
  'CD: Segnalazione (associazioni «è rilevata in», «è assegnata a», «genera»). '
  'Conserva la lettura ANPR; non conserva dichiarazione né foto del permesso (NRF_LEG_2).';
COMMENT ON COLUMN segnalazione.ultima_modifica IS
  'Colonna tecnica aggiornata da trigger: individua le segnalazioni cambiate per la mappa.';

-- Al più una segnalazione non chiusa per targa rilevata (vincolo 16).
CREATE UNIQUE INDEX segnalazione_una_non_chiusa_per_targa
  ON segnalazione (targa_rilevata) WHERE stato IN ('APERTA', 'PRESA_IN_CARICO');

CREATE INDEX segnalazione_stallo_idx ON segnalazione (stallo_id);
CREATE INDEX segnalazione_ausiliario_idx ON segnalazione (ausiliario_del_traffico_id);
CREATE INDEX segnalazione_ultima_modifica_idx ON segnalazione (ultima_modifica);

CREATE TRIGGER segnalazione_aggiorna_ultima_modifica
  BEFORE UPDATE ON segnalazione
  FOR EACH ROW EXECUTE FUNCTION aggiorna_ultima_modifica();

CREATE TRIGGER segnalazione_da_verifica_non_conforme
  BEFORE INSERT OR UPDATE OF verifica_del_permesso_id ON segnalazione
  FOR EACH ROW EXECUTE FUNCTION impedisci_segnalazione_da_verifica_conforme();
