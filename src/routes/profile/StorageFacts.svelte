<script lang="ts">
  import { formatBytes, type StorageStatus } from '../../lib/data/storage';

  // Persistenza e spazio usato (SPEC § 2): valgono solo per il contesto in cui l'app è aperta.
  interface Props {
    storage: StorageStatus | null;
  }

  let { storage }: Props = $props();

  const persistedText = $derived(
    storage === null
      ? '…'
      : !storage.supported || storage.persisted === null
        ? 'non disponibile'
        : storage.persisted
          ? 'attiva'
          : 'non attiva',
  );

  const usageText = $derived.by(() => {
    if (storage === null) return '…';
    if (storage.usageBytes === null) return 'non disponibile';
    const used = formatBytes(storage.usageBytes);
    return storage.quotaBytes === null ? used : `${used} di ${formatBytes(storage.quotaBytes)}`;
  });
</script>

<dl class="facts">
  <div><dt>Memoria protetta</dt><dd class:warn={storage?.persisted === false} data-testid="persist">{persistedText}</dd></div>
  <div><dt>Spazio usato</dt><dd class="mono" data-testid="usage">{usageText}</dd></div>
</dl>
<p class="hint">
  «Protetta» vuol dire che il telefono non cancella i dati quando lo spazio scarseggia. Su iPhone Safari e l'app
  installata hanno memorie separate: questi numeri valgono solo per dove è aperta la pagina.
</p>

<style>
  .facts {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .facts div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: 14px;
  }

  .facts dt {
    color: var(--muted);
  }

  .facts dd {
    margin: 0;
    text-align: right;
  }

  .warn {
    color: var(--tip);
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
