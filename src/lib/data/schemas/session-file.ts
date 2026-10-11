import { z } from 'zod';
import { envelope, isoDateTime } from './common';
import { sessionSchema } from './sessions';

export const SESSION_FILE_KIND = 'session';
export const SESSION_FILE_VERSION = 1;

/**
 * File di una sessione conclusa per il PT ("Invia al PT", M5): la sessione con la copia della scheda.
 * Sempre validato prima della consegna; l'import lato PT arriverà con una versione successiva.
 */
export const sessionFileSchema = z
  .object({
    ...envelope(SESSION_FILE_KIND, SESSION_FILE_VERSION),
    exportedAt: isoDateTime,
    session: sessionSchema,
  })
  .superRefine((file, ctx) => {
    if (file.session.endedAt === null) {
      ctx.addIssue({ code: 'custom', path: ['session', 'endedAt'], message: 'la sessione non è conclusa' });
    }
    if (file.session.live !== null) {
      ctx.addIssue({ code: 'custom', path: ['session', 'live'], message: 'una sessione conclusa non ha stato "in corso"' });
    }
  });

export type SessionFile = z.infer<typeof sessionFileSchema>;
