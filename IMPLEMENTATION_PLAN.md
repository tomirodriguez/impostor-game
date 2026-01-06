# Plan de Implementación - Impostor Game v2

## Resumen de Features

| # | Feature | Prioridad | Fase |
|---|---------|-----------|------|
| 1 | Reorganizar UI del Lobby (config básica + avanzada) | Alta | 1 |
| 2 | Cantidad de rondas configurable | Alta | 1 |
| 3 | Modo Speed (timer por turno) | Alta | 1 |
| 4 | Voto Secreto/Público | Media | 1 |
| 5 | Botón Skip en votación | Media | 1 |
| 6 | Configurar empate | Media | 1 |
| 7 | Pistas Encadenadas | Media | 2 |
| 8 | PWA Install Button | Alta | 2 |
| 9 | Modo Local/Offline | Media | 3 |

---

## Fase 1: Configuración y Votación

### 1.1 Reorganizar UI del Lobby

**Objetivo**: Separar configuración en "Básica" y "Avanzada" para no abrumar al host.

**Configuración Básica** (siempre visible):
- Categoría
- Cantidad de impostores

**Configuración Avanzada** (colapsable con botón):
- Mostrar categoría a jugadores (sí/no)
- Requerir pista escrita (sí/no)
- Modo de turnos (aleatorio/fijo)
- Cantidad de rondas
- Tiempo por turno (timer)
- Tipo de votación (secreta/pública)
- Permitir Skip en votación
- Regla de empate

**Cambios técnicos**:
- Refactorizar `Lobby.tsx` para separar secciones
- Componente colapsable `AdvancedSettings.tsx`
- Estado local para mostrar/ocultar avanzado

---

### 1.2 Cantidad de Rondas Configurable

**Descripción para el usuario**:
> **Límite de Rondas**: Define cuántas rondas durará la partida. Si el impostor sobrevive todas las rondas sin ser descubierto, gana automáticamente. Si es eliminado antes, ganan los ciudadanos.
>
> **Opciones**: 2, 3, 4, 5 rondas o "Sin límite" (el juego continúa hasta que el impostor sea eliminado o queden muy pocos jugadores).

**UI**: Dropdown con opciones:
- Sin límite (default)
- 2 rondas
- 3 rondas
- 4 rondas
- 5 rondas

**Cambios en Schema** (`convex/schema.ts`):
```typescript
// En games table agregar:
maxRounds: v.optional(v.number()), // undefined = sin límite
```

**Cambios en Backend** (`convex/games.ts` o `convex/rounds.ts`):
- En la función que avanza de ronda, verificar si `currentRound >= maxRounds`
- Si es así, terminar el juego con victoria del impostor

**Cambios en Frontend**:
- Dropdown en configuración avanzada del Lobby
- Mostrar "Ronda X de Y" durante el juego (si hay límite)

---

### 1.3 Modo Speed (Timer por Turno)

**Descripción para el usuario**:
> **Modo Speed**: Cada jugador tiene un tiempo límite para dar su pista. Un temporizador cuenta hacia atrás y cuando llega a cero:
> - Suena una alerta
> - Se pasa automáticamente al siguiente jugador
> - La pista aparece como "⏱️ Tiempo agotado"
>
> **Opciones de tiempo**: Sin límite (default), 10s, 15s, 20s, 30s
>
> **Tip**: Este modo es ideal para partidas rápidas y evita que los jugadores piensen demasiado sus pistas.

**UI**: Dropdown en configuración avanzada:
- Sin límite (default)
- 10 segundos
- 15 segundos
- 20 segundos
- 30 segundos

**Cambios en Schema** (`convex/schema.ts`):
```typescript
// En games table agregar:
turnTimeLimit: v.optional(v.number()), // segundos, undefined = sin límite
turnStartedAt: v.optional(v.number()), // timestamp de cuando empezó el turno actual
```

**Cambios en Backend**:
- Mutation `startTurn`: guarda `turnStartedAt = Date.now()`
- Mutation `submitClue`: verifica si el tiempo expiró (server-side validation)
- Mutation `timeoutTurn`: se llama cuando expira el timer, guarda pista como "⏱️ Tiempo agotado" y avanza al siguiente

**Cambios en Frontend**:
- Componente `TurnTimer.tsx`:
  - Muestra countdown circular o barra
  - Cambia de color cuando quedan 5 segundos (amarillo) y 3 segundos (rojo)
  - Sonido de tick en últimos 3 segundos
  - Sonido de alarma cuando termina
- En `ClueRound.tsx`:
  - Mostrar el timer si `turnTimeLimit` está configurado
  - Llamar a `timeoutTurn` cuando el countdown llega a 0
  - Deshabilitar input después del timeout

**Archivos de sonido necesarios**:
- `/public/sounds/tick.mp3` - sonido de tick
- `/public/sounds/timeout.mp3` - sonido de tiempo agotado

---

### 1.4 Voto Secreto/Público

**Descripción para el usuario**:
> **Votación Pública** (default): Los votos se muestran en tiempo real. Todos pueden ver quién votó a quién mientras se desarrolla la votación.
>
> **Votación Secreta**: Los votos están ocultos hasta que todos hayan votado. Solo se ve "X de Y jugadores han votado". Al final se revelan todos los votos juntos, generando más tensión y evitando el "efecto manada" (votar lo mismo que los demás).

**UI**: Toggle/Switch en configuración avanzada:
- [ ] Votación secreta

**Cambios en Schema** (`convex/schema.ts`):
```typescript
// En games table agregar:
secretVoting: v.optional(v.boolean()), // default false (público)
```

**Cambios en Frontend** (`Voting.tsx`):
- Si `secretVoting === true`:
  - No mostrar quién votó a quién durante la votación
  - Mostrar solo contador "3 de 5 han votado"
  - Al completar todos los votos, mostrar animación de reveal
- Si `secretVoting === false` (default):
  - Comportamiento actual (mostrar votos en tiempo real)

---

### 1.5 Botón Skip en Votación

**Descripción para el usuario**:
> **Opción Skip**: Durante la votación, podés elegir "Saltar" en lugar de votar a un jugador específico.
>
> Si "Saltar" obtiene más votos que cualquier jugador individual, nadie es eliminado y el juego continúa a la siguiente ronda.
>
> **Útil cuando**: No hay consenso claro, querés más información antes de eliminar, o sospechás que podrían eliminar a un inocente.

**UI**: Toggle en configuración avanzada:
- [ ] Permitir votar "Saltar"

En la pantalla de votación:
- Agregar opción "🚫 Saltar" al final de la lista de jugadores
- Visualmente diferenciada (quizás fondo gris o borde punteado)

**Cambios en Schema** (`convex/schema.ts`):
```typescript
// En games table agregar:
allowSkipVote: v.optional(v.boolean()), // default false

// En votes table, targetId puede ser null para skip:
// Ya es v.id("players"), habría que permitir null o usar un approach diferente
```

**Approach para Skip**:
- Opción A: Permitir `targetId: null` para representar skip
- Opción B: Campo adicional `isSkip: v.optional(v.boolean())`
- **Recomendado**: Opción A, modificar schema para `targetId: v.optional(v.id("players"))`

**Cambios en Backend**:
- Modificar conteo de votos para considerar skips
- Si skip tiene más votos que cualquier jugador → nadie eliminado

---

### 1.6 Configurar Empate

**Descripción para el usuario**:
> **¿Qué pasa cuando hay empate en la votación?**
>
> - **Eliminar a todos los empatados**: Si 2 o más jugadores tienen la misma cantidad de votos, todos son eliminados. Partidas más rápidas y arriesgadas.
>
> - **No eliminar a nadie**: Si hay empate, nadie es eliminado y se pasa a la siguiente ronda. Más conservador, favorece al impostor.
>
> - **Aleatorio**: Se elimina a uno de los empatados al azar. Añade un elemento de suerte.

**UI**: Dropdown en configuración avanzada:
- No eliminar a nadie (default)
- Eliminar a todos los empatados
- Eliminar uno aleatorio

**Cambios en Schema** (`convex/schema.ts`):
```typescript
// En games table agregar:
tieBreaker: v.optional(v.union(
  v.literal("none"),      // no eliminar (default)
  v.literal("all"),       // eliminar todos
  v.literal("random")     // eliminar uno random
)),
```

**Cambios en Backend** (función de resolución de votos):
```typescript
// Pseudocódigo
const maxVotes = Math.max(...voteCounts.values());
const playersWithMaxVotes = [...].filter(p => voteCounts[p] === maxVotes);

if (playersWithMaxVotes.length > 1) {
  // Hay empate
  switch (game.tieBreaker || "none") {
    case "none":
      // No eliminar a nadie
      break;
    case "all":
      // Eliminar a todos los empatados
      for (const playerId of playersWithMaxVotes) {
        await eliminatePlayer(playerId);
      }
      break;
    case "random":
      // Eliminar uno aleatorio
      const randomIndex = Math.floor(Math.random() * playersWithMaxVotes.length);
      await eliminatePlayer(playersWithMaxVotes[randomIndex]);
      break;
  }
} else {
  // Sin empate, eliminar al que tiene más votos
  await eliminatePlayer(playersWithMaxVotes[0]);
}
```

---

## Fase 2: Pistas y PWA

### 2.1 Pistas Encadenadas

**Descripción para el usuario**:
> **Pistas Encadenadas**: Tu pista debe comenzar con la última letra de la pista anterior.
>
> **Ejemplo**:
> - Jugador 1 dice: "CASA"
> - Jugador 2 debe empezar con "A": "ÁRBOL" ✓
> - Jugador 3 debe empezar con "L": "LUNA" ✓
> - Si Jugador 3 dice "PERRO" ✗ → Error, debe corregir
>
> **Nota**: El primer jugador de cada ronda puede dar cualquier pista.
>
> **Tip para impostores**: Esta regla puede ser tu aliada o tu enemiga. Prestá atención a qué letras te tocan y pensá rápido una palabra que suene relacionada.

**UI**: Toggle en configuración avanzada:
- [ ] Pistas encadenadas

En `ClueRound.tsx`:
- Mostrar prominente: "Tu pista debe empezar con: **A**"
- Validación en tiempo real mientras escribe
- Mensaje de error claro si no cumple

**Cambios en Schema** (`convex/schema.ts`):
```typescript
// En games table agregar:
chainedClues: v.optional(v.boolean()), // default false
```

**Cambios en Backend** (`submitClue` mutation):
```typescript
// Validación server-side
if (game.chainedClues) {
  const previousClue = await getLastClueOfRound(gameId, round);
  if (previousClue) {
    const requiredLetter = previousClue.clue.slice(-1).toUpperCase();
    const firstLetter = clue.charAt(0).toUpperCase();
    if (firstLetter !== requiredLetter) {
      throw new Error(`La pista debe empezar con "${requiredLetter}"`);
    }
  }
}
```

**Consideraciones**:
- Ignorar mayúsculas/minúsculas
- Ignorar acentos (A = Á)
- ¿Qué pasa con Ñ, números, o caracteres especiales? → Normalizar

---

### 2.2 PWA Install Button

**Descripción para el usuario**:
> **Instalá la app**: Tocá el botón "Instalar" para agregar Impostor Game a tu pantalla de inicio. Así podés acceder más rápido sin abrir el navegador.

**UI en Home**:
- Botón "📲 Instalar App" visible en la parte superior o inferior
- En iOS: Abre modal con instrucciones paso a paso
- En Android: Dispara el prompt nativo de instalación
- Si ya está instalada: No mostrar el botón

**Componentes nuevos**:
- `InstallPWAButton.tsx`
- `IOSInstallModal.tsx`

**Hook**:
```typescript
// hooks/useInstallPrompt.ts
export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Capturar evento beforeinstallprompt (Android/Chrome)
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
      }
    }
  };

  return { isInstalled, isIOS, canInstall: !!installPrompt, promptInstall };
}
```

**Modal iOS**:
```
┌─────────────────────────────────────┐
│  📲 Instalar en iPhone/iPad        │
│                                     │
│  1. Tocá el ícono de compartir [⬆] │
│     (en la barra del navegador)    │
│                                     │
│  2. Deslizá y seleccioná           │
│     "Agregar a inicio"             │
│                                     │
│  3. Tocá "Agregar"                 │
│                                     │
│          [Entendido]               │
└─────────────────────────────────────┘
```

---

## Fase 3: Modo Local/Offline

### 3.1 Pantalla Home Actualizada

**Nueva estructura de Home**:
```
┌─────────────────────────────────────┐
│                                     │
│         🎭 IMPOSTOR GAME           │
│                                     │
│    ┌─────────────────────────┐     │
│    │   📲 Instalar App       │     │
│    └─────────────────────────┘     │
│                                     │
│    ┌─────────────────────────┐     │
│    │   ➕ Crear Partida      │     │
│    └─────────────────────────┘     │
│                                     │
│    ┌─────────────────────────┐     │
│    │   🚪 Unirse a Sala      │     │
│    └─────────────────────────┘     │
│                                     │
│    ┌─────────────────────────┐     │
│    │   📴 Jugar Offline      │     │
│    └─────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

---

### 3.2 Modo Local Completo

**Descripción para el usuario**:
> **Modo Offline / Local**: Jugá sin necesidad de internet ni de que cada jugador tenga su propio dispositivo.
>
> **Cómo funciona**:
> 1. **Configuración**: El host crea la partida y escribe los nombres de todos los jugadores
> 2. **Asignación**: El juego asigna automáticamente quién es impostor y cuál es la palabra secreta
> 3. **Reveal secreto**: Se pasan el celular. Cada jugador:
>    - Toca su nombre
>    - Ve su rol y palabra EN SECRETO (los demás no deben mirar)
>    - Toca "Listo" y pasa el celular al siguiente
> 4. **Pistas**: Las pistas se dicen EN VOZ ALTA, en el orden que indica la app
> 5. **Votación**: El host pregunta a cada jugador a quién vota y lo marca en la app
> 6. **Resultado**: Se revela si el eliminado era impostor o no
>
> **Ideal para**: Jugar en persona, sin WiFi, o cuando no todos tienen celular.

**Flujo de pantallas**:

```
/local
  └─> LocalSetup (configurar partida + agregar nombres)
        └─> LocalReveal (pasar celular, ver palabra)
              └─> LocalClues (mostrar orden de pistas)
                    └─> LocalVoting (host marca votos)
                          └─> LocalResults (mostrar resultado)
                                └─> Siguiente ronda o fin
```

**Pantallas detalladas**:

#### LocalSetup
```
┌─────────────────────────────────────┐
│  📴 Partida Local                  │
│                                     │
│  Categoría: [Dropdown]             │
│  Impostores: [1] [2] [3]           │
│                                     │
│  ──── Configuración Avanzada ────  │
│  (mismas opciones que online)      │
│                                     │
│  ──── Jugadores ────               │
│  ┌─────────────────────────┐       │
│  │ Juan                 [x]│       │
│  │ María                [x]│       │
│  │ Pedro                [x]│       │
│  └─────────────────────────┘       │
│                                     │
│  [+ Agregar jugador]               │
│                                     │
│  Mínimo 3 jugadores                │
│                                     │
│    [🎮 Comenzar Partida]           │
│                                     │
└─────────────────────────────────────┘
```

#### LocalReveal (pantalla de transición)
```
┌─────────────────────────────────────┐
│                                     │
│     📱 Pasale el celular a:        │
│                                     │
│            JUAN                     │
│                                     │
│   (Los demás no deben mirar)       │
│                                     │
│       [Estoy listo, ver mi rol]    │
│                                     │
└─────────────────────────────────────┘
```

#### LocalReveal (pantalla de rol)
```
┌─────────────────────────────────────┐
│                                     │
│           👤 JUAN                   │
│                                     │
│    ┌───────────────────────┐       │
│    │                       │       │
│    │   Tu eres:            │       │
│    │   🕵️ CIUDADANO        │       │
│    │                       │       │
│    │   La palabra es:      │       │
│    │   🍕 PIZZA            │       │
│    │                       │       │
│    └───────────────────────┘       │
│                                     │
│   [✓ Entendido, pasar al siguiente]│
│                                     │
└─────────────────────────────────────┘
```

O si es impostor:
```
┌─────────────────────────────────────┐
│                                     │
│           👤 PEDRO                  │
│                                     │
│    ┌───────────────────────┐       │
│    │                       │       │
│    │   Tu eres:            │       │
│    │   🎭 IMPOSTOR         │       │
│    │                       │       │
│    │   No conocés la       │       │
│    │   palabra secreta.    │       │
│    │   ¡Descubrila!        │       │
│    │                       │       │
│    └───────────────────────┘       │
│                                     │
│   [✓ Entendido, pasar al siguiente]│
│                                     │
└─────────────────────────────────────┘
```

#### LocalClues
```
┌─────────────────────────────────────┐
│  🗣️ Ronda de Pistas               │
│                                     │
│  Ronda 1 de 3                       │
│  Categoría: Comidas (si aplica)    │
│                                     │
│  Orden para dar pistas:            │
│                                     │
│   1. 👉 JUAN     ← Es su turno     │
│   2.    MARÍA                       │
│   3.    PEDRO                       │
│                                     │
│  Cada jugador dice su pista        │
│  EN VOZ ALTA cuando sea su turno   │
│                                     │
│  [⏭️ Siguiente turno]              │
│                                     │
│  ─────────────────────────         │
│  [🗳️ Ir a votación]                │
│                                     │
└─────────────────────────────────────┘
```

#### LocalVoting
```
┌─────────────────────────────────────┐
│  🗳️ Votación                       │
│                                     │
│  Preguntá a cada jugador           │
│  a quién vota:                     │
│                                     │
│  ┌─────────────────────────┐       │
│  │ JUAN vota a:            │       │
│  │ ○ María                 │       │
│  │ ○ Pedro                 │       │
│  │ ○ Skip                  │       │
│  └─────────────────────────┘       │
│                                     │
│  ┌─────────────────────────┐       │
│  │ MARÍA vota a:           │       │
│  │ ○ Juan                  │       │
│  │ ○ Pedro                 │       │
│  │ ○ Skip                  │       │
│  └─────────────────────────┘       │
│                                     │
│  [📊 Ver Resultados]               │
│                                     │
└─────────────────────────────────────┘
```

**Almacenamiento**:
- Todo el estado en `localStorage` + React state
- Estructura:
```typescript
interface LocalGame {
  id: string;
  players: Array<{
    id: string;
    name: string;
    isImpostor: boolean;
    isEliminated: boolean;
    hasSeenRole: boolean;
  }>;
  secretWord: string;
  category: string;
  currentRound: number;
  maxRounds?: number;
  settings: {
    // mismas configuraciones que online
  };
  votes: Array<{
    round: number;
    voterId: string;
    targetId: string | null;
  }>;
}
```

---

## Cambios en Schema Final

```typescript
// convex/schema.ts
export default defineSchema({
  games: defineTable({
    code: v.string(),
    hostId: v.optional(v.id("players")),
    status: v.union(
      v.literal("lobby"),
      v.literal("reveal"),
      v.literal("clues"),
      v.literal("voting"),
      v.literal("results"),
      v.literal("finished")
    ),
    category: v.string(),
    impostorCount: v.number(),
    allImpostors: v.boolean(),

    // Configuración existente
    requireClueText: v.optional(v.boolean()),
    showCategory: v.optional(v.boolean()),
    turnMode: v.optional(v.union(v.literal("random"), v.literal("fixed"))),

    // NUEVOS CAMPOS
    maxRounds: v.optional(v.number()),           // Límite de rondas
    turnTimeLimit: v.optional(v.number()),       // Segundos por turno
    turnStartedAt: v.optional(v.number()),       // Timestamp inicio turno
    secretVoting: v.optional(v.boolean()),       // Votación secreta
    allowSkipVote: v.optional(v.boolean()),      // Permitir skip
    tieBreaker: v.optional(v.union(              // Regla de empate
      v.literal("none"),
      v.literal("all"),
      v.literal("random")
    )),
    chainedClues: v.optional(v.boolean()),       // Pistas encadenadas

    // Campos existentes
    currentRound: v.number(),
    secretWord: v.optional(v.string()),
    turnOrder: v.optional(v.array(v.id("players"))),
    currentTurnIndex: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  // ... resto igual, pero votes.targetId debe permitir null para skip
  votes: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    voterId: v.id("players"),
    targetId: v.optional(v.id("players")), // MODIFICADO: optional para skip
  })
    .index("by_game_and_round", ["gameId", "round"])
    .index("by_voter", ["gameId", "round", "voterId"]),
});
```

---

## Archivos a Crear/Modificar

### Fase 1
- [ ] `convex/schema.ts` - Agregar nuevos campos
- [ ] `convex/games.ts` - Mutations para crear con nuevas opciones
- [ ] `convex/rounds.ts` - Lógica de límite de rondas y timer
- [ ] `convex/votes.ts` - Lógica de skip y empate
- [ ] `src/components/Lobby.tsx` - UI config básica + avanzada
- [ ] `src/components/AdvancedSettings.tsx` - NUEVO: panel colapsable
- [ ] `src/components/Voting.tsx` - Skip, votación secreta
- [ ] `src/components/ClueRound.tsx` - Timer
- [ ] `src/components/TurnTimer.tsx` - NUEVO: componente timer
- [ ] `public/sounds/tick.mp3` - Sonido tick
- [ ] `public/sounds/timeout.mp3` - Sonido timeout

### Fase 2
- [ ] `src/components/ClueRound.tsx` - Pistas encadenadas
- [ ] `src/components/InstallPWAButton.tsx` - NUEVO
- [ ] `src/components/IOSInstallModal.tsx` - NUEVO
- [ ] `src/hooks/useInstallPrompt.ts` - NUEVO
- [ ] `src/pages/Home.tsx` - Agregar botón instalar

### Fase 3
- [ ] `src/pages/Local.tsx` - NUEVO: página principal modo local
- [ ] `src/components/local/LocalSetup.tsx` - NUEVO
- [ ] `src/components/local/LocalReveal.tsx` - NUEVO
- [ ] `src/components/local/LocalClues.tsx` - NUEVO
- [ ] `src/components/local/LocalVoting.tsx` - NUEVO
- [ ] `src/components/local/LocalResults.tsx` - NUEVO
- [ ] `src/hooks/useLocalGame.ts` - NUEVO: lógica del juego local
- [ ] `src/pages/Home.tsx` - Agregar botón "Jugar Offline"

---

## Orden de Implementación

```
Día 1-2: Fase 1
├── Schema updates
├── Lobby UI refactor (básica + avanzada)
├── Cantidad de rondas
├── Voto secreto/público
├── Botón Skip
├── Configurar empate
└── Modo Speed (timer)

Día 3: Fase 2
├── Pistas encadenadas
└── PWA Install Button

Día 4-5: Fase 3
└── Modo Local completo
```
