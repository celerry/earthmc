import { URL } from "node:url"

export class EarthMC {
    /**
     * The base URL of the EarthMC API
     * @private
     * @constant
     */
    private readonly BASE_URL = "https://api.earthmc.net/v3"

    /**
     * The server we are checking against
     */
    private serverStr: string

    /**
     * represents a queue of request timestamps used for rate limiting
     *
     * each entry in the queue contains a timestamp indicating when the request was made
     * @private
     */
    private requestQueue: { timestamp: number }[] = []

    /**
     * the maximum number of requests allowed within the specified time window for rate limiting
     * @private
     */
    private maxRequestsPerWindow: number

    /**
     * the time window in milliseconds for rate limiting
     *
     * this determines the duration over which the maximum number of requests is calculated
     * @private
     */
    private windowSize: number

    /**
     * @param {object} [options] - options for rate limiting
     * @param {string} [options.server=aurora] - the server we are checking against
     * @param {number} [options.maxRequestsPerWindow=Number.MAX_SAFE_INTEGER] - maximum number of requests allowed within the specified time window
     * @param {number} [options.windowSize=300000] - time window in milliseconds
     */
    constructor(options?: { server?: string; maxRequestsPerWindow?: number; windowSize?: number }) {
        this.serverStr = "aurora"
        this.maxRequestsPerWindow = options?.maxRequestsPerWindow ?? Number.MAX_SAFE_INTEGER // default: unlimited
        this.windowSize = options?.windowSize ?? 300000 // default: 5 minutes (300,000 milliseconds)
    }

    /**
     * performs an HTTP GET request
     * @param {URL} url - the URL to fetch
     * @param {number} [retryCount=3] - how many times to retry in the case of a 504 (timeout) error
     * @returns {Promise<Response>} a promise that resolves to the fetched response
     */
    private async get(url: URL, retryCount: number = 3): Promise<Response> {
        await this.rateLimit()
        url.searchParams.append("no-cache-please", `${Date.now()}~${Math.random().toPrecision(2)}`)

        try {
            const response = await fetch(url.toString(), {
                headers: {
                    "X-Origin": `celerry`,
                },
            })

            if (response.status === 504 && retryCount > 0) {
                console.log("Encountered 504 Gateway Timeout. Retrying...")
                return await this.get(url, retryCount - 1)
            }

            return response
        } catch (error) {
            throw error
        }
    }

    /**
     * enforces rate limiting on the requests
     *
     * this method ensures that the number of requests made within a specific time window does not exceed a predefined limit
     *
     * if the limit is reached, it delays further requests until the rate limit is satisfied
     * @returns {Promise<void>} a promise that resolves when the rate limit is satisfied.
     */
    private async rateLimit(): Promise<void> {
        const now = Date.now()

        // filter the request queue to remove old requests outside the current window
        this.requestQueue = this.requestQueue.filter((req) => req.timestamp + this.windowSize > now)

        // check if the number of requests exceeds the maximum allowed within the window
        if (this.requestQueue.length >= this.maxRequestsPerWindow) {
            const timeToWait = this.requestQueue[0].timestamp + this.windowSize - now // time to wait before allowing another request

            // delay further requests by waiting until the time window expires
            await new Promise((resolve) => setTimeout(resolve, timeToWait))
        }

        // add the current request to the queue
        this.requestQueue.push({ timestamp: now })
    }

    /**
     * retrieves Minecraft UUIDs corresponding to Discord IDs
     * @param ids - an array of Discord IDs or Minecraft UUIDs
     * @returns a promise resolving to an array of objects containing UUIDs and Discord IDs
     */
    public async discord(...ids: (string | UUID)[]): Promise<DiscordResponse[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/discord`)
        url.searchParams.append("query", ids.join(","))

        const response: Response = await this.get(url)

        return (await response.json()) as DiscordResponse[]
    }

    /**
     * retreives the towns present at locations
     * @param locations - an array of x,y coordinates
     * @returns a promise resolving an array of towns present at locations
     */
    public async location(...locations: XYCoordinate[]): Promise<LocationsResponse[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/location`)
        let query: string[] = []
        for (const location of locations) {
            let q = ""
            q += Math.round(location[0]).toString()
            q += ";"
            q += Math.round(location[1]).toString()

            query.push(q)
        }
        url.searchParams.append("query", query.join(","))

        const response: Response = await this.get(url)

        return (await response.json()) as LocationsResponse[]
    }

    /**
     * retrieves all nations
     * @returns a promise resolving an array of every nation's name and uuid
     */
    public async nations(): Promise<NamedObject[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/nations`)

        const response: Response = await this.get(url)

        return (await response.json()) as NamedObject[]
    }

    /**
     * retrieves detailed information about a nation (or multiple)
     * @param ids - an array of nation UUIDs or nation names
     * @returns a promise resolving an array of every queried nation's full information
     */
    public async nation(...ids: (string | UUID)[]): Promise<NationResponse[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/nations`)
        url.searchParams.append("query", ids.join(","))

        const response: Response = await this.get(url)

        return (await response.json()) as NationResponse[]
    }

    /**
     * retrieves all towns
     * @returns a promise resolving an array of every town's name and uuid
     */
    public async towns(): Promise<NamedObject[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/towns`)

        const response: Response = await this.get(url)

        return (await response.json()) as NamedObject[]
    }

    /**
     * retrieves detailed information about a town (or multiple)
     * @param ids - an array of town UUIDs or town names
     * @returns a promise resolving an array of every queried town's full information
     */
    public async town(...ids: (string | UUID)[]): Promise<TownResponse[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/towns`)
        url.searchParams.append("query", ids.join(","))

        const response: Response = await this.get(url)

        return (await response.json()) as TownResponse[]
    }

    /**
     * retrieves a list of all towns within the specified radius around the specified town, empty if none are present
     *
     * this is measured town block to town block
     * @param town the town's name or UUID
     * @param radius the radius to check, as an integer. if a float is given, it is rounded to the nearest integer
     * @returns a promise resolving an array of town names and uuids
     */
    public async nearbyTown(town: string | UUID, radius: number): Promise<NamedObject[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/towns`)
        url.searchParams.append("town", town)
        url.searchParams.append("radius", Math.round(radius).toString())

        const response: Response = await this.get(url)

        return (await response.json()) as NamedObject[]
    }

    /**
     * retrieves a list of all towns within the specified radius around the specified coordinate, empty if none are present
     *
     * this is measured town block to town block
     * @param coords the x and y coordinate to check from
     * @param radius the radius to check, as an integer. if a float is given, it is rounded to the nearest integer
     * @returns a promise resolving an array of town names and uuids
     */
    public async nearbyCoord(coords: XYCoordinate, radius: number): Promise<NamedObject[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/towns`)
        url.searchParams.append("x", Math.round(coords[0]).toString())
        url.searchParams.append("z", Math.round(coords[1]).toString())
        url.searchParams.append("radius", Math.round(radius).toString())

        const response: Response = await this.get(url)

        return (await response.json()) as NamedObject[]
    }

    /**
     * retrieves all players
     * @returns a promise resolving an array of every players's name and uuid
     */
    public async players(): Promise<NamedObject[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/players`)

        const response: Response = await this.get(url)

        return (await response.json()) as NamedObject[]
    }

    /**
     * retrieves detailed information about a player (or multiple)
     * @param ids - an array of player UUIDs or names
     * @returns a promise resolving an array of every queried player's full information
     */
    public async player(...ids: (string | UUID)[]): Promise<PlayerResponse[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/players`)
        url.searchParams.append("query", ids.join(","))

        const response: Response = await this.get(url)

        return (await response.json()) as PlayerResponse[]
    }

    /**
     * retrieves all quarters uuids
     * @returns a promise resolving an array of every quarters' uuid
     */
    public async quarters(): Promise<UUID[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/quarters`)

        const response: Response = await this.get(url)

        return (await response.json()) as UUID[]
    }

    /**
     * retrieves detailed information about a quarter (or multiple)
     * @param ids - an array of quarter uuid's
     * @returns a promise resolving an array of every queried quarters's full information
     */
    public async quarter(...ids: (string | UUID)[]): Promise<QuarterResponse[]> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/quarters`)
        url.searchParams.append("query", ids.join(","))

        const response: Response = await this.get(url)

        return (await response.json()) as QuarterResponse[]
    }

    /**
     * retrieves information about the server
     * @returns a promise resolving to information about the server
     */
    public async server(): Promise<ServerResponse> {
        const url = new URL(`${this.BASE_URL}/${this.serverStr}/`)

        const response: Response = await this.get(url)

        return (await response.json()) as ServerResponse
    }
}

type DiscordResponse = {
    /**
     * A Minecraft UUID
     */
    uuid: UUID
    /**
     * A Discord user ID
     */
    id: string
}

/**
 * An object that contains a name and a UUID
 */
type NamedObject = {
    name: string | null
    uuid: UUID | null
}

type LocationsResponse = {
    /** The location this response is for */
    location: {
        x: number
        y: number
    }
    /**
     * Whether the location is in the wilderness (unclaimed land)
     */
    isWilderness: boolean
    /**
     * The town at this location, if any
     */
    town: NamedObject
    /**
     * The nation that the town at this location is part of
     */
    nation: NamedObject
}

type NationResponse = NamedObject & {
    /** Nation's board as seen on /n, null if no board is set */
    board: string | null
    /** Nation's hex Dynmap colour */
    dynmapColour: string
    /** Nation's hex Dynmap outline */
    dynmapOutline: string
    /** The nation's wiki URL as a string if set */
    wiki: string | null
    king: NamedObject
    capital: NamedObject
    timestamps: {
        /** A Unix timestamp representing when the nation was created */
        registered: number
    }
    status: {
        isPublic: boolean
        isOpen: boolean
        isNeutral: boolean
    }
    stats: {
        numTownBlocks: number
        numResidents: number
        numTowns: number
        numAllies: number
        numEnemies: number
        balance: number
    }
    coordinates: {
        spawn: Coordinate
    }
    /** An array representing all the residents in this nation */
    residents: NamedObject[]
    /** An array representing all the towns in this nation */
    towns: NamedObject[]
    /** An array representing all the allies this nation has, empty if the nation has no allies */
    allies: NamedObject[]
    /** An array reresenting all the enemies this nation has, empty if the nation has no enemies */
    enemies: NamedObject[]
    /** An array representing all the towns this nation has sanctioned, empty if the nation has sanctioned no towns */
    sanctioned: NamedObject[]
    /** Arrays of everyone in every rank in the nation, ranks with no players are empty */
    ranks: { [key: string]: string[] }
}

type TownResponse = NamedObject & {
    /** Town's board as seen on /t, null if none is present */
    board: string | null
    /** The founder of the town as seen on /t */
    founder: string
    /** The town's wiki URL as a string if set */
    wiki: string | null
    mayor: NamedObject
    nation: NamedObject
    timestamps: {
        /** A Unix timestamp representing when the town was created */
        registered: number
        /** A Unix timestamp representing when the town joined its nation, null if the town has no nation */
        joinedNationAt: number | null
        /** A Unix timestamp representing when the town fell to ruin, null if the town is not ruined */
        ruinedAt: number | null
    }
    status: {
        isPublic: boolean
        isOpen: boolean
        isNeutral: boolean
        isCapital: boolean
        isOverClaimed: boolean
        isRuined: boolean
        isForSale: boolean
        hasNation: boolean
        hasOverclaimShield: boolean
    }
    stats: {
        numTownBlocks: number
        maxTownBlocks: number
        numResidents: number
        numTrusted: number
        numOutlaws: number
        balance: number
        forSalePrice: number | null
    }
    perms: Perms
    coordinates: {
        spawn: Coordinate
        /** X and Z of the town's home block */
        homeBlock: XYCoordinate
        /** A JSON array representing all the town blocks in this town, first value is X, second is Z, multiply by 16 to get actual coordinate */
        townBlocks: XYCoordinate[]
    }
    /** An array representing all the residents in the town */
    residents: NamedObject[]
    /** An array representing all the trusted residents in the town, empty if nobody has been trusted */
    trusted: NamedObject[]
    /** An array representing all the outlawed players of the town, empty if the town has not outlawed anybody */
    outlaws: NamedObject[]
    /** The UUID of every quarter in this town, can be looked up in the quarter's endpoint, empty if none are present */
    quarters: UUID[]
    /** Arrays of everyone in every rank in the town, ranks with no players are empty */
    ranks: { [key: string]: string[] }
}

type PlayerResponse = NamedObject & {
    /** Title set through `/n set title`, null if no title is set */
    title: string | null
    /** Surname set through `/n set surname`, null if no surname is set */
    surname: string | null
    /** Formatted name combining title, username and surname */
    formattedName: string
    /** About section of `/res`, set with `/res set about`, null if there is no about set */
    about: string | null
    town: NamedObject
    nation: NamedObject
    timestamps: {
        /** A unix timestamp representing the time the player joined the server */
        registered: number
        /** A unix timestamp representing when the player joined their town, null if the player is not in a town */
        joinedTownAt: number
        /** A unix timestamp representing when the player was last online, can be null if the player is an NPC */
        lastOnline: number
    }
    status: {
        isOnline: boolean
        isNPC: boolean
        isMayor: boolean
        isKing: boolean
        hasTown: boolean
        hasNation: boolean
    }
    stats: {
        /** The player's current gold balance seen on `/res` */
        balance: number
        /** The amount of friends the player has */
        numFriends: number
    }
    perms: Perms
    ranks: {
        /** An array of town ranks the player holds, empty if they hold no town ranks */
        townRanks: string[]
        /** An array of nation ranks the player holds, empty if they hold no nation ranks */
        nationRanks: string[]
    }
    /** An array of players the player is friends with */
    friends: NamedObject[]
}

type QuarterResponse = {
    uuid: UUID
    type: QuarterType
    /** Nested values are null if the quarter has no owner */
    owner: NamedObject
    town: NamedObject
    timestamps: {
        /** A unix timestamp representing the time the quarter was created */
        registered: number
        /** A unix timestamp representing the time the quarter was claimed at, null if it hasn't been claimed yet */
        claimedAt: number | null
    }
    status: {
        isEmbassy: false
    }
    stats: {
        /** The price of the quarter. null if the quarter is not for sale */
        price: number | null
        /** The total number of blocks within the quarter's bounds */
        volume: number
        /** The total amount of cuboids the quarter is made of */
        numCuboids: number
    }
    /** The RGB value of the quarter */
    colour: [number, number, number]
    trusted: NamedObject[]
    cuboids: QuarterCuboid[]
}

type QuarterType = "APARTMENT" | "COMMONS" | "PUBLIC" | "SHOP" | "STATION" | "WORKSITE"

type QuarterCuboid = {
    pos1: XYZCoordinate
    pos2: XYZCoordinate
}

type ServerResponse = {
    /** The server's current version as a string */
    version: string
    /** The moon's current phase */
    moonPhase: MoonPhase
    timestamps: {
        /** Time the new day occurs at */
        newDayTime: number
    }
    status: {
        /** Whether it's currently raining (raining, but not a storm) */
        hasStorm: boolean
        /** Whether it's currently thundering (raining, and a storm) */
        isThundering: boolean
    }
    stats: {
        /** The amount of ticks that have passed within the current day */
        time: number
        /** The amount of ticks that have ever passed */
        fullTime: number
        /** The total amount of players that can connect to the server */
        maxPlayers: number
        /** The current amount of online players */
        numOnlinePlayers: number
        /** The current amount of online players with no town */
        numOnlineNomads: number
        /** The total amount of currently registered Towny residents */
        numResidents: number
        /** The total amount of currently registered Towny residents who have no town */
        numNomads: number
        /** The total amount of currently registered Towny towns */
        numTowns: number
        /** The total amount of town blocks across all towns */
        numTownBlocks: number
        /** The total amount of currently registered Towny nations */
        numNations: number
        /** The total amount of Quarters on the server */
        numQuarters: number
        /** The total amount of cuboids within all quarters */
        numCuboids: number
    }
    voteParty: {
        /** The total votes required to trigger a vote party */
        target: number
        /** The votes remaining before a vote party */
        numRemaining: number
    }
}

type MoonPhase = "FIRST_QUARTER" | "FULL_MOON" | "LAST_QUARTER" | "NEW_MOON" | "WANING_CRESCENT" | "WANING_GIBBOUS" | "WAXING_CRESCENT" | "WAXING_GIBBOUS"

type Coordinate = {
    /** The world the coordinate belongs to */
    world: string
    x: number
    y: number
    z: number
    /** The coordinate's pitch (up and down) */
    pitch: number
    /** The coordinate's yaw (left to right) */
    yaw: number
}

type XYCoordinate = [
    /** X Coordinate */
    number,
    /** Y Coordinate */
    number
]

type XYZCoordinate = [
    /** X Coordinate */
    number,
    /** Y Coordinate */
    number,
    /** Z Coordinate */
    number
]

type Perms = {
    build: [boolean, boolean, boolean, boolean]
    destroy: [boolean, boolean, boolean, boolean]
    switch: [boolean, boolean, boolean, boolean]
    itemUse: [boolean, boolean, boolean, boolean]
    flags: {
        pvp: boolean
        explosion: boolean
        fire: boolean
        mobs: boolean
    }
}

type UUID = `${string}-${string}-${string}-${string}-${string}`
