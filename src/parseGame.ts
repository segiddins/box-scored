import * as CSV from "@vanillaes/csv";
import { Base, parsePlay, Play as ParsedPlay } from "./parsePlay";
import { POSITIONS } from "./positions";

function last<T>(arg0: T[]): T | undefined {
  return arg0.slice().pop();
}

export type Logs = { games: Game[] };

export enum Team {
  home = "1",
  away = "0",
}
export class Appearance {
  constructor(
    public playerID: string,
    public name: string,
    public team: "0" | "1",
    public slot: number,
    public appearanceNumber: number,
    public pos: string
  ) {}
}

export type Play = {
  inning: number;
  battingTeam: Team;
  batterID: string;
  count: string;
  pitches: string;
  play: ReturnType<typeof parsePlay>;
  batterHand?: string;
  comments: string[];
  substitutions: { from: Appearance; to: Appearance }[];
  precedingState: GameState;
};
export type Info = {
  visteam: string;
  hometeam: string;
  site: string;
  date: string;
  number: string;
  starttime: string;
};
export type Game = {
  id: string;
  version: string;
  info: Info;
  starters: Appearance[];
  events: Play[];
  data: any[];
  stats: any[];
  comments: any[];
  state: GameState;
};

type PickFields<T, U> = {
  [P in keyof T]: T[P] extends U ? T[P] : never;
};

export class Statline {
  positions: typeof POSITIONS[keyof typeof POSITIONS][] = [];
  atBats = 0;
  plateAppearances = 0;
  hitByPitches = 0;
  singles = 0;
  doubles = 0;
  triples = 0;
  homeruns = 0;
  hits = 0;
  walks = 0;
  strikeouts = 0;

  record(
    stat: keyof Omit<Statline, "positions" | "record">,
    count: number = 1
  ) {
    this[stat] += count;
    switch (stat) {
      case "plateAppearances":
      case "hits":
        throw new Error(`do not record ${stat} directly`);

      case "atBats":
        break;

      case "singles":
      case "doubles":
      case "triples":
      case "homeruns":
      case "strikeouts":
        this.atBats += count;
        break;

      case "walks":
      case "hitByPitches":
        break;

      default:
        let _a: never = stat;
        return _a;
    }

    this.hits = this.singles + this.doubles + this.triples + this.homeruns;
    this.plateAppearances = this.atBats + this.walks + this.hitByPitches;
  }
}

type StatsKey = Pick<
  Appearance,
  "playerID" | "slot" | "appearanceNumber" | "team" | "name"
>;
class Stats {
  constructor(
    // private teamTotals: Statline | null,
    private stats: Record<string, [StatsKey, Statline]> = {}
  ) {}

  stat(app: Appearance): Statline {
    const key = JSON.stringify({ ...app, pos: undefined });
    const v = this.stats[key];
    let statline = v && v[1];
    if (!statline) {
      statline = new Statline();
      this.stats[key] = [app, statline];
    }
    const positions = statline.positions;
    if (last(positions) !== app.pos) positions.push(app.pos);
    return statline;
  }

  copy() {
    return new Stats({ ...this.stats });
  }

  all() {
    return Object.values(this.stats);
  }
}

export type GameState = {
  players: Appearance[];
  errors: any[];
  gdp: any[];
  stats: Stats;
  inning: number;
  battingTeam: Team;
  outs: number;
  pitching: Appearance;
  bases: [null, Appearance | null, Appearance | null, Appearance | null];
  batting: Appearance;
  onDeck: Appearance;
  inTheHole: Appearance;
  nextUp: Record<Team, number>;
  slotsAway: (arg0: Team, arg1: number) => number;
  score: { home: number; away: number };
};

function isHome(base: Base): boolean {
  if (typeof base.value === "string") {
    return base.value === "Home";
  }

  return base.value[0] === "Home";
}

const opponent = (t: Team) => {
  return t === Team.home ? Team.away : Team.home;
};

export function changedState(
  state: Readonly<GameState>,
  changes: (state: GameState) => GameState
): GameState {
  const newState: GameState = changes({
    stats: state.stats.copy(),
    bases: [null, state.bases[1], state.bases[2], state.bases[3]],
    score: { ...state.score },
    players: state.players.slice(),
    errors: state.errors,
    gdp: state.gdp,
    inning: state.inning,
    battingTeam: state.battingTeam,
    outs: state.outs,
    pitching: state.pitching,
    batting: state.batting,
    onDeck: state.onDeck,
    inTheHole: state.inTheHole,
    nextUp: { ...state.nextUp },
    slotsAway: state.slotsAway,
  });

  if (newState.outs >= 3) {
    if (state.battingTeam === Team.home) {
      newState.inning += 1;
    }
    newState.battingTeam = opponent(state.battingTeam);
    newState.bases = [null, null, null, null];

    newState.outs = 0;
  }
  for (const app of newState.players) newState.stats.stat(app);

  newState.pitching = newState.players.find(
    (p) => p.pos === "1" && p.team === opponent(newState.battingTeam)
  )!;
  newState.batting = newState.players.find(
    (p) =>
      p.team === newState.battingTeam &&
      p.slot === newState.slotsAway(newState.battingTeam, 0)
  )!;
  newState.onDeck = newState.players.find(
    (p) =>
      p.team === newState.battingTeam &&
      p.slot === newState.slotsAway(newState.battingTeam, 1)
  )!;
  newState.inTheHole = newState.players.find(
    (p) =>
      p.team === newState.battingTeam &&
      p.slot === newState.slotsAway(newState.battingTeam, 2)
  )!;

  return newState;
}

export function makeInitialState(game: Game): GameState {
  return changedState(
    {
      players: game.starters.slice(),
      errors: [],
      gdp: [],
      stats: new Stats(),
      inning: 1,
      battingTeam: Team.away,
      outs: 0,
      pitching: undefined as any,
      bases: [null, null, null, null],
      batting: undefined as any,
      onDeck: undefined as any,
      inTheHole: undefined as any,
      score: { home: 0, away: 0 },
      nextUp: { "0": 1, "1": 1 },
      slotsAway: function (team, slots) {
        return ((this.nextUp[team] - 1 + slots) % 9) + 1;
      },
    },
    (x) => x
  );
}

export function reduceState(
  state: Readonly<GameState>,
  play: ParsedPlay,
  batterID: string
): GameState {
  const [{ value: basicPlay }, , advancements] = play.value;

  if (state.batting.playerID !== batterID) {
    throw new Error(
      `Expected ${JSON.stringify(
        state.batting
      )} to be up, instead it is ${batterID}`
    );
  }

  const newState = changedState(state, (x) => x);

  const batterStats = state.stats.stat(state.batting);

  const score = (count: number) => {
    newState.score[state.battingTeam === Team.home ? "home" : "away"] += count;
  };
  const out = (count: number = 1) => {
    newState.outs += count;
  };
  const advanceBatter = (times: number = 1) => {
    newState.nextUp[newState.battingTeam] = newState.slotsAway(
      newState.battingTeam,
      times
    );
  };

  switch (basicPlay.name) {
    case "Caught Stealing":
      out();
      break;
    case "Out":
      out();
      advanceBatter();
      batterStats.record("atBats");
      break;
    case "Strikeout":
      out();
      advanceBatter();
      batterStats.record("strikeouts");
      console.log("Stikeout", batterStats, newState.batting);
      for (const baserunning of basicPlay.value) {
        if (["Caught Stealing", "Pick Off"].includes(baserunning.name)) {
          newState.outs += 1;
        }
      }
      for (const a of advancements) {
        const [from] = a.value.value;
        if (isHome(from)) {
          newState.outs -= 1; // batter reached or catcher threw out at 1B
        }
      }
      break;
    case "Walk":
    case "Intentional Walk":
      batterStats.record("walks");
      for (const baserunning of basicPlay.value) {
        if (["Caught Stealing", "Pick Off"].includes(baserunning.name))
          newState.outs += 1;
      }
      newState.bases[1] = state.batting;
      advanceBatter();
      break;
    case "Hit By Pitch":
      newState.bases[1] = state.batting;
      advanceBatter();
      break;
    case "Pick Off": {
      const [base, fielderOrError] = basicPlay.value;
      if (fielderOrError && fielderOrError.name === "Error") {
        const fromIdx = Number(base.value.slice(0, 1));
        newState.bases[fromIdx] = null;
      } else {
        newState.outs += 1;
      }
      break;
    }
    case "Double Play":
      newState.outs += 2;
      advanceBatter();
      break;
    case "Hit":
      advanceBatter();
      const hit = basicPlay.value;
      if (["Home Run", "Inside The Park Home Run"].includes(hit.name)) {
        score(1); // runners are scored via advancement?
        batterStats.record("homeruns");
      } else if (hit.name === "Single") {
        newState.bases[1] = state.batting;
        batterStats.record("singles");
      } else if (hit.name === "Double") {
        newState.bases[2] = state.batting;
        batterStats.record("doubles");
      } else if (hit.name === "Triple") {
        newState.bases[3] = state.batting;
        batterStats.record("triples");
      }
      break;

    case "Stolen Base": {
      const base = basicPlay.value;
      break;
    }

    case "Error":
    case "Fielders Choice":
    case "Interference":
      advanceBatter();
      break;

    case "Balk":
    case "No Play":
    case "Error on foul fly ball":
    case "Stolen Base":
    case "Double Steal":
    case "Defensive Indifference":
    case "Passed Ball":
    case "Wild Pitch":
      break;

    default:
      let _a: never = basicPlay;
      return _a;
  }

  for (const advance_ of advancements) {
    const advance = advance_.value;
    const [from, to] = advance.value;

    const fromIdx = Number(from.value.slice(0, 1));
    const fromPlayer = isHome(from) ? state.batting : state.bases[fromIdx];
    newState.bases[fromIdx] = null;

    if (advance.name === "Successful Advancement") {
      if (isHome(to)) {
        score(1);
      } else {
        const toIdx = Number(to.value.slice(0, 1));
        newState.bases[toIdx] = fromPlayer;
      }
    } else if (advance.name === "Failed Advancement") {
      const [, { value: to }, fielderOrError] = advance.value;
      newState.outs += 1;
      if (
        (fielderOrError && fielderOrError.name === "Error") ||
        (Array.isArray(to) && to[1].length > 0)
      )
        newState.outs -= 1; // not actually an out?
    }
  }

  return changedState(newState, (x) => x);
}

export async function getLogs(): Promise<Logs> {
  const response = await fetch(
    // "https://raw.githubusercontent.com/chadwickbureau/retrosheet/master/event/regular/2020NYA.EVA",
    "./chadwickbureau-retrosheet/event/regular/2020NYA.EVA",
    { method: "GET" }
  );
  const body = await response.text();

  const logs: Logs = { games: [] };

  const lines: Array<string[]> = CSV.parse(body);

  let batHand = " ";
  let batHandBatter = "";

  for (const line of lines) {
    let currentGame: Game;
    if (line[0] === "id") {
      currentGame = {
        info: {} as Info,
        id: null as unknown as string,
        version: null as unknown as string,
        starters: [],
        events: [],
        data: [],
        stats: [],
        comments: [],
        state: null as unknown as any,
      };
      logs.games.push(currentGame);
    } else {
      currentGame = logs.games.slice().pop()!;
    }
    const origLine = line.slice();
    const tok = line.shift();

    if (tok === "id" || tok === "version") {
      (currentGame as any)[tok] = line.shift();
    } else if (tok === "info") {
      const k = line.shift();
      const v = line.shift();
      (currentGame.info as any)[k!] = v;
    } else if (tok === "start" || tok === "sub") {
      const playerID = line.shift()!;
      const name = line.shift()!;
      const team = line.shift()! as Team;
      const slot = Number(line.shift()!);
      const pos = line.shift()!;
      const app: Appearance = {
        playerID,
        name,
        team,
        slot,
        pos,
        appearanceNumber: 0,
      };
      if (tok === "start") {
        currentGame.starters.push(app);
      } else if (tok === "sub") {
        const idx = currentGame.state.players.findIndex(({ team, slot }) => {
          return team === app.team && slot === app.slot;
        });
        if (idx === -1)
          throw new Error(
            `Missing player for substition ${JSON.stringify(
              app
            )} in ${JSON.stringify(currentGame.state.players)}`
          );

        const old = currentGame.state.players[idx];

        currentGame.state = changedState(currentGame.state, (state) => {
          state.players[idx] = {
            ...app,
            appearanceNumber:
              old.playerID === app.playerID
                ? old.appearanceNumber
                : old.appearanceNumber + 1,
          };
          return state;
        });

        last(currentGame.events)!.substitutions.push({ from: old, to: app });
      }
    } else if (tok === "play") {
      if (!currentGame.state) currentGame.state = makeInitialState(currentGame);
      const inning = line.shift();
      const battingTeam = line.shift() as Team;
      const batterID = line.shift()!;
      const count = line.shift()!.replace(/(\d)(\d)/, "$1-$2");
      const pitches = line.shift()!;
      const play = line.shift()!;

      const parsedPlay = parsePlay(play);

      currentGame.events.push({
        inning: Number(inning),
        battingTeam,
        batterID,
        count,
        pitches,
        play: parsedPlay,
        comments: [],
        substitutions: [],
        precedingState: currentGame.state,
      });

      if (batHand !== " " && batHandBatter === batterID) {
        last(currentGame.events)!.batterHand = batHand;
      } else {
        batHand = " ";
        batHandBatter = " ";
      }

      if (parsedPlay.type === "ParseOK")
        currentGame.state = reduceState(
          currentGame.state,
          parsedPlay.value,
          batterID
        );
    } else if (tok === "com") {
      // attach properly, then parse text
      const lastPlay = last(currentGame.events);
      if (lastPlay) {
        lastPlay.comments.push(line.shift()!);
      } else {
        currentGame.comments.push({
          text: line.shift(),
        });
      }
    } else if (tok === "stat") {
      last(currentGame.events)!.comments.push(
        ["Unhandled", tok, ...line].join(",")
      );
    } else if (tok === "event") {
      last(currentGame.events)!.comments.push(
        ["Unhandled", tok, ...line].join(",")
      );
    } else if (tok === "line") {
      last(currentGame.events)!.comments.push(
        ["Unhandled", tok, ...line].join(",")
      );
    } else if (tok === "badj") {
      last(currentGame.events)!.comments.push(
        ["Unhandled", tok, ...line].join(",")
      );
    } else if (tok === "padj") {
      last(currentGame.events)!.comments.push(
        ["Unhandled", tok, ...line].join(",")
      );
    } else if (tok === "ladj") {
      last(currentGame.events)!.comments.push(
        ["Unhandled", tok, ...line].join(",")
      );
    } else if (tok === "radj") {
      const playerID = line.shift()!;
      const base = Number(line.shift()!);
      currentGame.state = changedState(currentGame.state, (state) => {
        state.bases[base] = state.players.find(
          (pl) => pl.playerID === playerID
        )!;
        return state;
      });
    } else if (tok === "data") {
      currentGame.data.push([...line]);
      line.length = 0;
    } else {
      throw new Error(`Unhandled line type ${tok}`);
    }

    if (line.length > 0) {
      throw new Error(`Remaining tokens ${line} in ${origLine} for ${tok}`);
    }
  }

  return logs as Logs;
}
