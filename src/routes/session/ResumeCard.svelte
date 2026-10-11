<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import { deleteSession } from '../../lib/data/repo/sessions';
  import type { Session } from '../../lib/data/schemas/sessions';
  import { currentItem } from '../../lib/sessions/edit';
  import { timeOfDay } from '../../lib/sessions/format';
  import { sessionItems } from '../../lib/sessions/items';
  import { liveHref } from '../../lib/sessions/nav';
  import { doneSets, plannedSets } from '../../lib/sessions/stats';
  import ConfirmSheet from '../train/ConfirmSheet.svelte';

  // Sessione non terminata (anche dopo che iOS ha chiuso l'app): Allena e, in M6, la Home.
  interface Props {
    session: Session;
  }

  let { session }: Props = $props();

  const items = $derived(sessionItems(session).length);
  let confirmOpen = $state(false);
</script>

<Card tone="training" label="Allenamento in corso" glow>
  <div class="top">
    <span class="mono-label kicker"><span class="dot" aria-hidden="true"></span> In corso · dalle {timeOfDay(session.startedAt)}</span>
  </div>
  <h2 class="name">{session.workoutName}</h2>
  <span class="mono meta">
    {doneSets(session)}/{plannedSets(session)} serie · esercizio {currentItem(session) + 1} di {items}
  </span>
  <div class="actions">
    <Button tone="training" size="lg" href={liveHref(session.id)}>Riprendi allenamento</Button>
    <Button variant="secondary" tone="neutral" onclick={() => (confirmOpen = true)}>Abbandona</Button>
  </div>
</Card>

<ConfirmSheet
  bind:open={confirmOpen}
  title="Abbandonare l’allenamento?"
  text="«{session.workoutName}»: le serie segnate finora verranno cancellate e la sessione non finirà nello storico. Non si può annullare."
  actions={[
    { label: 'Abbandona', kind: 'danger', run: () => void deleteSession(session.id) },
    { label: 'Continua', kind: 'secondary', run: () => {} },
  ]}
/>

<style>
  .top {
    display: flex;
    align-items: center;
  }

  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--tone);
    font-size: 12px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--tone);
    box-shadow: 0 0 8px var(--tone-glow);
  }

  .name {
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 30px;
    line-height: 1.05;
    color: var(--tone);
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 13px;
    color: var(--text-2);
  }

  .actions {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
</style>
