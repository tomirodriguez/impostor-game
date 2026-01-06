# El Impostor

Juego de deduccion social para jugar con amigos. Un jugador es el impostor y debe pasar desapercibido mientras los demas intentan descubrirlo.

## Stack Tecnologico

- **Frontend:** React + TypeScript + Vite
- **Backend:** Convex (base de datos reactiva en tiempo real)
- **PWA:** Instalable en dispositivos moviles y desktop

## Requisitos

- Node.js 18+
- Cuenta de Convex (gratis en [convex.dev](https://convex.dev))

## Instalacion

1. Clona el repositorio e instala dependencias:

```bash
npm install
```

2. Configura Convex (esto creara tu proyecto en Convex Cloud):

```bash
npx convex dev
```

Esto abrira el navegador para autenticarte y creara el archivo `.env.local` con tu `VITE_CONVEX_URL`.

3. En otra terminal, inicia el servidor de desarrollo:

```bash
npm run dev
```

4. Abre http://localhost:5173 en tu navegador.

## Como Jugar

### Crear una partida
1. Ingresa tu nombre
2. Click en "Crear Partida"
3. Comparte el link con tus amigos (3-20 jugadores)

### Configuracion (solo el host)
- **Categoria:** Elige el tema de las palabras (animales, comida, peliculas, etc.)
- **Impostores:** Cuantos impostores habra (1 o mas)
- **Modo Broma:** Todos son impostores (nadie conoce la palabra)

### Flujo del juego
1. **Revelacion:** Cada jugador ve su rol en secreto
   - Jugadores normales: ven la palabra secreta
   - Impostores: solo saben que son impostores
2. **Ronda de pistas:** Por turnos, cada jugador da UNA palabra como pista
3. **Votacion:** Todos votan a quien creen que es el impostor
4. **Resultados:** Se revela si el eliminado era impostor o inocente
5. **Continuar:** Nueva ronda con nueva palabra, o fin si se cumplen las condiciones

### Condiciones de victoria
- **Grupo gana:** Todos los impostores son eliminados
- **Impostores ganan:** Quedan igual o mas impostores que inocentes

### Puntuacion
| Evento | Puntos |
|--------|--------|
| Votar correctamente al impostor | +10 |
| Impostor eliminado (todos los inocentes) | +5 |
| Impostor sobrevive la ronda | +15 |

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de produccion
npm run preview  # Preview del build
```

## Estructura del Proyecto

```
impostor-game/
├── src/
│   ├── components/     # Componentes de React
│   ├── pages/          # Paginas (Home, Game)
│   ├── hooks/          # Custom hooks
│   └── lib/            # Utilidades
├── convex/
│   ├── schema.ts       # Esquema de base de datos
│   ├── games.ts        # Funciones de partidas
│   ├── players.ts      # Funciones de jugadores
│   ├── rounds.ts       # Logica de rondas
│   └── words.ts        # Diccionario de palabras
└── public/             # Assets estaticos
```

## Despliegue

### Frontend (Vercel, Netlify, etc.)

1. Conecta tu repositorio
2. Configura la variable de entorno `VITE_CONVEX_URL` con tu URL de Convex
3. Deploy automatico en cada push

### Backend (Convex)

```bash
npx convex deploy
```

Esto despliega tu backend a produccion en Convex Cloud.

## PWA

La aplicacion es instalable como PWA:
- En Chrome/Edge: Click en el icono de instalacion en la barra de direcciones
- En Safari iOS: Compartir > Agregar a pantalla de inicio
- En Android: Menu > Agregar a pantalla de inicio

## Licencia

MIT
