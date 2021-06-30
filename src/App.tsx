import React from "react";
import { useLocation, BrowserRouter } from "react-router-dom";
import * as QueryString from "query-string";
import { Alert, Card, Table } from "./Components";
import * as CSV from "@vanillaes/csv";
import classnames from "classnames";
import { POSITIONS } from "./positions";
import { BasicPlays, Modifiers, playIsScoring, Plays } from "./parsePlay";
import { Game, Info, getLogs, Play, Logs, Team } from "./parseGame";

type Park = {
  parkID: string;
  name: string;
  aka: string;
  city: string;
  state: string;
  start: Date;
  end: Date;
  league: string;
  notes: string;
};
async function getParks(): Promise<Map<string, Park>> {
  const response = await fetch(
    // "https://raw.githubusercontent.com/chadwickbureau/retrosheet/master/misc/parkcode.txt",
    "chadwickbureau-retrosheet/misc/parkcode.txt",
    { method: "GET" }
  );
  const body = await response.text();
  const parks = CSV.parse(body, { typed: true })
    .slice(1)
    .map(([parkID, name, aka, city, state, start, end, league, notes]) => ({
      parkID,
      name,
      aka,
      city,
      state,
      start,
      end,
      league,
      notes,
    }));

  const ret = new Map<string, Park>();
  for (const park of parks) {
    ret.set(park.parkID, park);
  }

  return ret;
}

type Person = {
  retrosheetID: string;
  name: string;
};
async function getPeople(): Promise<Map<string, Person>> {
  const response = await fetch(
    // "https://raw.githubusercontent.com/chadwickbureau/retrosheet/master/misc/parkcode.txt",
    "./chadwickbureau-registry/people.csv",
    { method: "GET" }
  );
  const body = await response.text();
  const people = CSV.parse(body, { typed: true })
    .slice(1)
    .map(
      ([
        key_person,
        key_uuid,
        key_mlbam,
        key_retro,
        key_bbref,
        key_bbref_minors,
        key_fangraphs,
        key_npb,
        key_sr_nfl,
        key_sr_nba,
        key_sr_nhl,
        key_findagrave,
        name_last,
        name_first,
        name_given,
        name_suffix,
        name_matrilineal,
        name_nick,
        birth_year,
        birth_month,
        birth_day,
        death_year,
        death_month,
        death_day,
        pro_played_first,
        pro_played_last,
        mlb_played_first,
        mlb_played_last,
        col_played_first,
        col_played_last,
        pro_managed_first,
        pro_managed_last,
        mlb_managed_first,
        mlb_managed_last,
        col_managed_first,
        col_managed_last,
        pro_umpired_first,
        pro_umpired_last,
        mlb_umpired_first,
        mlb_umpired_last,
      ]) => ({
        retrosheetID: key_retro,
        name_last,
        name_first,
        name_given,
        name_suffix,
        name_matrilineal,
        name_nick,
        name: `${name_first} ${name_last}`,
      })
    );

  const ret = new Map<string, Person>();
  for (const person of people) {
    ret.set(person.retrosheetID, person);
  }

  return ret;
}

const MetadataContext = React.createContext<{
  parks: Map<string, Park>;
  people: Map<string, Person>;
}>({
  parks: new Map(),
  people: new Map(),
});

const GameInfo = ({ info }: { info: Info }) => {
  const parks = React.useContext(MetadataContext).parks;

  const transformer: Record<string, (s: string) => string> = {
    site: (s: string) => {
      return parks.get(s)?.name || s;
    },
  };

  return (
    <div
      className={classnames(
        "grid",
        "items-stretch",
        "justify-evenly",
        "grid-cols-2",
        "sm:grid-cols-3",
        "lg:grid-cols-6"
      )}
    >
      {Object.entries(info).map(([k, v]) => (
        <span
          className="flex flex-col p-2 sm:p-3 lg:px-4 place-items-center"
          key={k}
        >
          <div className="text-sm font-semibold">{k}</div>
          <div className="text-lg">{(transformer[k] || ((s) => s))(v)}</div>
        </span>
      ))}
    </div>
  );
};

const StartingLineup = ({ game }: { game: Game }) => {
  return (
    <div
      className="grid grid-flow-col-dense gap-2 content-center justify-items-stretch text-left items-baseline"
      style={{ gridTemplateColumns: "3fr 1rem minmax(1rem, 1fr) 3fr 1rem" }}
    >
      <div className="col-start-1 col-span-5 text-xl place-self-center">
        Starting Lineups
      </div>
      <div className="col-span-2  col-start-1 text-lg place-self-center">
        {game.info.hometeam}
      </div>
      <div className="col-span-1  col-start-3 justify-self-stretch" />
      <div className="col-span-2  col-start-4 text-lg place-self-center">
        {game.info.visteam}
      </div>
      {game.starters.map((s) => (
        <div className={classnames("contents")} key={s.playerID}>
          <div
            className={classnames({
              "col-start-1": s.team === "0",
              "col-start-4": s.team === "1",
            })}
          >
            {s.name}
          </div>
          <div
            className={classnames("place-self-end", {
              "col-start-2": s.team === "0",
              "col-start-5": s.team === "1",
            })}
          >
            {POSITIONS[s.pos] || s.pos}
          </div>
        </div>
      ))}
    </div>
  );
};
const BoxScore = ({ game }: { game: Game }) => {
  const teams = [Team.away, Team.home];

  const stats = teams.map((team) => {
    const apps = game.state.stats.all().filter(([a]) => a.team === team);
    apps.sort(([a], [b]) => {
      let comp = a.slot - b.slot;
      if (comp !== 0) {
        if (b.slot === 0 || a.slot === 0) comp = -comp;
        return comp;
      }

      comp = a.appearanceNumber - b.appearanceNumber;

      return comp;
    });
    return apps;
  });

  return (
    <div className="lg:flex justify-around">
      {teams.map((team, idx) => (
        <Table.Table
          data={stats[idx]}
          key={team}
          columns={[
            {
              header: game.info[team === Team.away ? "visteam" : "hometeam"],
              // eslint-disable-next-line react/display-name
              builder: ([app, stat]) => (
                <span
                  className={classnames({
                    "ml-2": app.appearanceNumber !== 0,
                  })}
                >
                  {app.name} {stat.positions.map((p) => POSITIONS[p]).join("-")}{" "}
                  {app.appearanceNumber}
                </span>
              ),
            },
            {
              header: "AB",
              // eslint-disable-next-line react/display-name
              builder: ([app, stat]) => <span>{stat.atBats}</span>,
            },
            {
              header: "H",
              // eslint-disable-next-line react/display-name
              builder: ([app, stat]) => <span>{stat.hits}</span>,
            },
            {
              header: "BB",
              // eslint-disable-next-line react/display-name
              builder: ([app, stat]) => <span>{stat.walks}</span>,
            },
            {
              header: "SO",
              // eslint-disable-next-line react/display-name
              builder: ([app, stat]) => <span>{stat.strikeouts}</span>,
            },
          ]}
        />
      ))}
    </div>
  );
};

const PlayNode = ({
  node,
}: {
  node: Exclude<Plays, Modifiers> | BasicPlays;
}): React.ReactElement => {
  switch (node.name) {
    case "Modifier": {
      const [mod, hitLoc] = node.value;
      return (
        <>
          {" "}
          {mod.name}
          {hitLoc && <> to {hitLoc.value.desc}</>}.
        </>
      );
    }
    case "Basic Play":
      return (
        <>
          <PlayNode node={node.value} />.
        </>
      );
    case "Pick Off":
    case "Caught Stealing": {
      const [base, fielders] = node.value;
      return (
        <>
          {node.name} at <PlayNode node={base} />, <PlayNode node={fielders} />
        </>
      );
    }
    case "Out": {
      const [fielders, base] = node.value;
      return (
        <>
          {node.name}, <PlayNode node={fielders} />
          {base && (
            <>
              {" "}
              at <PlayNode node={base} />
            </>
          )}
        </>
      );
    }

    case "Error": {
      const [assist, fielder, modifier] = node.value;
      return (
        <>
          {node.name}, <PlayNode node={fielder} />
          {assist && (
            <>
              ; assist by <PlayNode node={assist} />
            </>
          )}
          {modifier && (
            <>
              {" "}
              (<PlayNode node={modifier} />)
            </>
          )}
        </>
      );
    }
    case "Fielders Choice":
      return (
        <>
          {node.name}
          {node.value && (
            <>
              , <PlayNode node={node.value} />
            </>
          )}
        </>
      );
    case "Balk":
    case "Defensive Indifference":
    case "Ground Rule Double":
    case "Hit By Pitch":
    case "Home Run":
    case "No Play":
    case "Passed Ball":
    case "Wild Pitch":
    case "throwing":
    case "Team Unearned Run":
    case "Unearned Run":
    case "RBI credited":
    case "No RBI credited":
      return <>{node.name}</>;
    case "Strikeout":
    case "Walk":
    case "Intentional Walk": {
      const baserunning = node.value;
      return (
        <>
          {node.name}
          {baserunning.flatMap((br, idx) => [
            <> (</>,
            <PlayNode node={br} key={idx} />,
            <>)</>,
          ])}
        </>
      );
    }
    case "Base": {
      if (Array.isArray(node.value)) {
        const [name, modifiers] = node.value;
        const m = modifiers
          .flatMap((a, idx) => [<PlayNode node={a} key={idx} />, ", "])
          .slice(0, -1);
        const p = m.length === 0 ? null : <> ({m})</>;
        return (
          <>
            {name}
            {p}
          </>
        );
      }

      return <>{node.value}</>;
    }
    case "Fielder":
      return <>{node.value}</>;
    case "Hit":
      return <PlayNode node={node.value} />;
    case "Advancement":
      return (
        <>
          {" "}
          <PlayNode node={node.value} />.
        </>
      );
    case "Single":
    case "Double":
    case "Triple":
    case "Inside The Park Home Run":
      return (
        <>
          {node.name} to <PlayNode node={node.value} />
        </>
      );
    case "Fielders":
      return (
        <span>
          {node.value
            .flatMap((f) => [<PlayNode node={f} key={f.value} />, <> to </>])
            .slice(0, -1)}
        </span>
      );
    case "Play":
      return (
        <span>
          {node.value.map((n) =>
            Array.isArray(n) ? (
              n.map((n1, idx) => <PlayNode node={n1} key={n1.name + idx} />)
            ) : (
              <PlayNode node={n} key={n.name} />
            )
          )}
        </span>
      );
    case "Double Play": {
      const [f1, b, f2] = node.value;
      return (
        <>
          {node.name}, <PlayNode node={f1} /> out at <PlayNode node={b} />
          {f2 && (
            <>
              {" "}
              by <PlayNode node={f2} />
            </>
          )}
        </>
      );
    }
    case "Stolen Base":
      return (
        <>
          Stole <PlayNode node={node.value} />
        </>
      );
    case "Double Steal":
      return (
        <>
          {node.value
            .flatMap((sb, idx) => [<PlayNode node={sb} key={idx} />, " and "])
            .slice(0, -1)}
        </>
      );
    case "Successful Advancement": {
      const [from, to, error] = node.value;
      return (
        <>
          Runner advanced from <PlayNode node={from} /> to{" "}
          <PlayNode node={to} />
          {error && (
            <>
              {" "}
              (<PlayNode node={error} />)
            </>
          )}
        </>
      );
    }
    case "Failed Advancement": {
      const [, { value: to }, fielderOrError] = node.value;
      const notAnOut =
        (fielderOrError && fielderOrError.name === "Error") ||
        (Array.isArray(to) && to[1].length > 0);

      return (
        <>
          Runner {notAnOut ? "safe" : "out"} advancing from{" "}
          <PlayNode node={node.value[0]} /> to <PlayNode node={node.value[1]} />
          {node.value[2] && (
            <>
              {" "}
              (<PlayNode node={node.value[2]} />)
            </>
          )}
        </>
      );
    }
    case "Interference": {
      const fielder = node.value;
      return (
        <>
          <PlayNode node={fielder} /> interference
        </>
      );
    }
    case "Error on foul fly ball": {
      const fielder = node.value;
      return (
        <>
          {node.name} by <PlayNode node={fielder} />
        </>
      );
    }

    default:
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let _a: never = node;
      return _a;
  }
};

const PlayC = ({ play: parse }: { play: Play["play"] }) => {
  if (parse.type === "ParseFail") {
    return (
      <div>
        Parsing failed
        <pre>
          {parse.source}
          <br />
          {" ".repeat(parse.location.column - 1)}^
        </pre>
        Expected one of:
        <ul className={classnames("list-disc", "list-inside")}>
          {parse.expected.map((e, idx) => (
            <li key={idx}>
              <pre className="inline">{e}</pre>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // const [basicPlay, modifiers, advancements] = parse.value.value;

  // assert(basicPlay.name === "Basic Play");

  // function isEmpty(arg0: { length: number } | null | any): boolean {
  //   if (!arg0) return true;
  //   if (Array.isArray(arg0) && arg0.length === 0) {
  //     return true;
  //   }
  //   return false;
  // }

  // const mf = modifiers.length > 0 && (
  //   <>
  //     Modifiers <pre>{JSON.stringify(modifiers, null, 2)}</pre>
  //   </>
  // );

  // const af = advancements.length > 0 && (
  //   <>
  //     advancements <pre>{JSON.stringify(advancements, null, 2)}</pre>
  //   </>
  // );

  // let v: React.ReactNode = null;

  // if (!isEmpty(basicPlay.value.value)) {
  //   if (typeof basicPlay.value.value === "string") {
  //     v = basicPlay.value.value;
  //   } else if (Array.isArray(basicPlay.value.value)) {
  //     v = <pre>{JSON.stringify(basicPlay.value.value, null, 2)}</pre>;
  //   } else if ("name" in basicPlay.value.value) {
  //     v = <pre>{JSON.stringify(basicPlay.value.value, null, 2)}</pre>;
  //   } else {
  //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //     let _a: never = basicPlay.value.value;
  //   }
  // }

  const { value: play } = parse;

  return (
    <span className={classnames({ "font-bold": playIsScoring(play) })}>
      <PlayNode node={play} />
    </span>
  );
};

const PlayByPlay = ({ game }: { game: Game }) => {
  const people = React.useContext(MetadataContext).people;
  return (
    <Table.Table
      className={classnames("table", "table-auto")}
      data={game.events}
      ifEmpty={<>Huh, a game with no events. How strange!</>}
      row={(event) => {
        return {
          className: classnames(
            "table-row",
            "border-b",
            "border-gray-300",
            "align-text-top",
            {
              "bg-gray-200": event.battingTeam === Team.away,
              "font-bold":
                event.play.type === "ParseOK" &&
                playIsScoring(event.play.value),
              "bg-red-200": event.play.type === "ParseFail",
            }
          ),
        };
      }}
      columns={[
        {
          header: "Inning",
          // eslint-disable-next-line react/display-name
          builder: (event) => (
            <span
              className={classnames({
                "bg-red-300":
                  event.battingTeam !== event.precedingState.battingTeam ||
                  event.inning !== event.precedingState.inning,
              })}
            >
              {(event.battingTeam !== event.precedingState.battingTeam ||
                event.inning !== event.precedingState.inning) &&
                "XXXXX"}
              {event.battingTeam === "0" ? "Top" : "Bottom"} {event.inning}
            </span>
          ),
        },
        {
          header: "Outs",
          builder: (event) => event.precedingState.outs,
        },
        {
          header: "Score",
          // eslint-disable-next-line react/display-name
          builder: (event) => (
            <>
              {event.precedingState.score.away} -{" "}
              {event.precedingState.score.home}
            </>
          ),
        },
        {
          header: "Bases",
          builder: (event) =>
            event.precedingState.bases
              .slice(1)
              .map((runner, idx) => (runner !== null ? idx + 1 : "x"))
              .join(""),
        },
        {
          header: "Pitching",
          builder: (event) => event.precedingState.pitching.name,
        },
        {
          header: "Batting",
          builder: (event) => {
            const batting = event.precedingState.batting;
            if (batting.playerID !== event.batterID) {
              return `Expected ${JSON.stringify(
                batting
              )} to be up, instead it is ${event.batterID}`;
            }
            return batting.name;
          },
        },
        {
          header: "Count",
          builder: (event) => event.count,
        },
        {
          header: "Play",
          // eslint-disable-next-line react/display-name
          builder: (event) => (
            <>
              <PlayC play={event.play} />
              {event.comments.map((c, idx) => (
                <p key={idx}>{c}</p>
              ))}
              {event.substitutions.map(({ from, to }, idx) => (
                <p key={idx}>
                  {from.playerID === to.playerID && (
                    <>
                      {from.name} moved from {POSITIONS[from.pos]} to{" "}
                      {POSITIONS[to.pos]}
                    </>
                  )}
                  {from.playerID !== to.playerID && (
                    <>
                      {to.name} replaced {from.name},
                      {to.slot !== 0 && ` batting ${to.slot} and`} playing{" "}
                      {POSITIONS[to.pos]}
                    </>
                  )}
                  .
                </p>
              ))}
            </>
          ),
        },
      ]}
    />
  );
};

const GameC = ({ game }: { game: Game }) => {
  return (
    <>
      <Card.Card>
        <Card.Title>
          <a
            href={`https://www.retrosheet.org/boxesetc/${game.id.slice(
              3,
              7
            )}/B${game.id.slice(7) + game.id.slice(0, 7)}.htm`}
            target={game.id}
          >
            {game.info.visteam} ({game.state.score.away}) @ {game.info.hometeam}{" "}
            ({game.state.score.home}) on {game.info.date}
            {game.info.number !== "0" && ` (${game.info.number})`}
          </a>
        </Card.Title>
        <Card.Body>
          <Card.Actions />
          <Card.Text>
            <div
              className={classnames("grid", "gap-6")}
              style={{ gridTemplateColumns: "100%" }}
            >
              <GameInfo info={game.info} />
              {/* <StartingLineup game={game} /> */}
              <BoxScore game={game} />
              <PlayByPlay game={game} />
            </div>
          </Card.Text>
        </Card.Body>
      </Card.Card>
    </>
  );
};

const LogsC = ({ logs }: { logs: Logs }) => {
  return (
    <>
      <div className="flex flex-col">
        {logs.games.map((game) => (
          <div className="mb-6 mx-4" key={game.id}>
            <GameC game={game} key={game.id} />
          </div>
        ))}
      </div>
    </>
  );
};

function Body() {
  const [logs, setLogs] = React.useState<Logs | null>(null);
  const [parks, setParks] = React.useState<Map<string, Park> | null>(null);
  const [people, setPeople] = React.useState<Map<string, Person> | null>(null);

  const { search } = useLocation();

  React.useEffect(() => {
    const query = QueryString.parse(search);
    const str = (name: string): string | null => {
      const v = query[name];
      return typeof v === "string" ? v : null;
    };

    getLogs({ year: str("year") || "2020", team: str("team") || "NYA" }).then(
      (logs) => setLogs(logs)
    );
    // getParks().then((parks) => {
    //   setParks(parks);
    // });
    // getPeople().then((people) => {
    //   setPeople(people);
    // });
  }, [setLogs, setParks, setPeople, search]);

  return (
    <>
      <Alert variant="error">
        <span className="md:hidden">Welcome to BoxScored</span>
        <span className="hidden md:inline">
          Welcome to BoxScored, a thing{" "}
          <a
            href="https://segiddins.me/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            segiddins@
          </a>{" "}
          built.
        </span>
      </Alert>

      <MetadataContext.Provider
        value={{ parks: parks || new Map(), people: people || new Map() }}
      >
        {logs && <LogsC logs={logs} />}
      </MetadataContext.Provider>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Body />
    </BrowserRouter>
  );
}

export default App;
