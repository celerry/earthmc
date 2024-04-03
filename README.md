# EarthMC API Wrapper


## Installation

See the [package on JSR](https://jsr.io/@celery/earthmc).


## Example Usage

```ts
import { EarthMC } from "@celery/earthmc";

const api = new EarthMC({ name: "foo" })

const players = await api.players() // [{ uuid:  ... , name: ... }, ...]
const town = await api.town(players[0].town.uuid) // [{ board: ... , ... }]
```