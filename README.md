# EarthMC API Wrapper

```ts
import { EarthMC } from "@celery/earthmc";

const api = new EarthMC()

const players = await api.players() // [{ uuid:  ... , name: ... }, ...]
const town = await api.town(players[0].town.uuid) // [{ board: ... , ... }]
```