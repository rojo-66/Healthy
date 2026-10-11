// IndexedDB finto in memoria (Node non ce l'ha). Deve caricarsi prima di Dexie, che legge
// `indexedDB` quando viene importato: per questo sta qui e non nei singoli test.
import 'fake-indexeddb/auto';
