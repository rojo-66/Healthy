<script lang="ts">
  import ImportScreen from './share/ImportScreen.svelte';

  // `#/importa?da=allena|dieta|link`: ricevi una scheda o un piano (SPEC § 8.4).
  interface Props {
    query: Readonly<Record<string, string>>;
  }

  let { query }: Props = $props();
</script>

<ImportScreen from={query['da'] ?? ''} />
