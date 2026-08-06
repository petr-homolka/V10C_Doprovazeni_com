import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Konfigurace VÝHRADNĚ pro designový náhled (`design-preview.html`, viz
 * `src/preview/main.tsx` pro zdůvodnění, proč existuje).
 *
 * Služby a `lib/firebase` jsou nahrazené stuby, takže se skutečné stránky
 * appky vykreslí proti vzorovým datům bez sítě, bez Firebase a bez
 * přihlášení. Stránky samotné se NEMĚNÍ — díky tomu náhled nemůže lhát.
 *
 * Aliasy jsou VĚDOMĚ uvedené celou cestou (`@/services/xyz`), ne wildcard —
 * když se přidá nová služba a stránka ji začne používat, náhled spadne
 * hlasitě na chybějícím stubu, místo aby tiše sáhl po skutečném Firebase.
 */
const stub = (name: string) => path.resolve(__dirname, `./src/preview/stubs/${name}.ts`)

export default defineConfig({
  resolve: {
    alias: [
      { find: '@/lib/firebase', replacement: stub('firebase') },
      { find: '@/services/organizationService', replacement: stub('organizationService') },
      { find: '@/services/familyService', replacement: stub('familyService') },
      { find: '@/services/agreementService', replacement: stub('agreementService') },
      { find: '@/services/staffService', replacement: stub('staffService') },
      { find: '@/services/familyStarService', replacement: stub('familyStarService') },
      { find: '@/services/timelineService', replacement: stub('timelineService') },
      { find: '@/services/calendarEventService', replacement: stub('calendarEventService') },
      { find: '@/services/taskService', replacement: stub('taskService') },
      { find: '@/services/enumOptionsService', replacement: stub('enumOptionsService') },
      { find: '@/services/documentService', replacement: stub('documentService') },
      { find: '@/services/messageService', replacement: stub('messageService') },
      { find: '@/services/collaboratorService', replacement: stub('collaboratorService') },
      { find: '@/services/avatarService', replacement: stub('avatarService') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  plugins: [react()],
  build: {
    rollupOptions: { input: path.resolve(__dirname, 'design-preview.html') },
    outDir: 'dist-preview',
  },
})
