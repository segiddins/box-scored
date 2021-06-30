import { POSITIONS } from "./positions";
import * as bnb from "bread-n-butter";

const fielder = bnb
  .match(/[1-9]/)
  .map((s) => POSITIONS[s])
  .desc(["position"])
  .node("Fielder");
export type Fielder = ReturnType<typeof fielder["tryParse"]>;

const error = bnb
  .all(
    fielder.or(bnb.ok(null)).skip(bnb.text("E")),
    fielder,
    bnb
      .text("/TH")
      .map(() => "TH" as "TH")
      .node("throwing")
      .or(bnb.ok(null))
  )
  .node("Error");

const base = bnb
  .choice(
    bnb.text("1").next(bnb.ok("1B" as "1B")),
    bnb.text("2").next(bnb.ok("2B" as "2B")),
    bnb.text("3").next(bnb.ok("3B" as "3B")),
    bnb
      .text("H")
      .next(bnb.ok("Home" as "Home"))
      .and(
        bnb
          .choice(
            // TODO: capture these params
            error,
            bnb.text("TUR").node("Team Unearned Run"),
            bnb.text("UR").node("Unearned Run"),
            bnb.text("RBI").node("RBI credited"),
            bnb.text("NR").or(bnb.text("NORBI")).node("No RBI credited")
          )
          .wrap(bnb.text("("), bnb.text(")"))
          .repeat(0)
      ),
    bnb.text("B").next(bnb.ok("Home" as "Home"))
  )
  .desc(["base"])
  .node("Base");
export type Base = ReturnType<typeof base["tryParse"]>;

const fielders = fielder.repeat(1).desc(["fielders"]).node("Fielders");
export type Fielders = ReturnType<typeof fielders["tryParse"]>;

const out = fielders
  .and(base.wrap(bnb.text("("), bnb.text(")")).or(bnb.ok(null)))
  .node("Out");
const hit = bnb
  .choice(
    bnb.text("S").next(fielders).node("Single"),
    bnb.text("D").next(fielders).node("Double"),
    bnb.text("T").next(fielders).node("Triple"),
    bnb
      .text("HR")
      .or(bnb.text("H"))
      .next(fielders)
      .node("Inside The Park Home Run"),
    bnb.text("HR").or(bnb.text("H")).node("Home Run"),
    bnb.text("DGR").node("Ground Rule Double")
  )
  .node("Hit");
export type Hit = ReturnType<typeof hit["tryParse"]>;

const hbp = bnb.text("HP").node("Hit By Pitch");
const np = bnb.text("NP").node("No Play");

const stolenBase = bnb.text("SB").next(base).node("Stolen Base");
const doubleSteal = stolenBase.sepBy(bnb.text(";"), 2).node("Double Steal");

const baserunning = bnb.choice(
  bnb.text("BK").node("Balk"),
  bnb
    .text("CS")
    .next(bnb.all(base, fielders.wrap(bnb.text("("), bnb.text(")"))))
    .node("Caught Stealing"),
  bnb
    .all(
      bnb.text("PO").next(base),
      error.or(fielders).wrap(bnb.text("("), bnb.text(")"))
    )
    .node("Pick Off"),
  doubleSteal,
  stolenBase,
  bnb.text("PB").node("Passed Ball"),
  bnb.text("DI").node("Defensive Indifference"),
  bnb.text("WP").node("Wild Pitch")
);

const optionalBaserunningAddOn = bnb.text("+").next(baserunning).repeat();

const strikeout = bnb
  .text("K")
  .next(optionalBaserunningAddOn)
  .node("Strikeout");
const intentionalWalk = bnb
  .match(/IW?/)
  .next(optionalBaserunningAddOn)
  .node("Intentional Walk");
const walk = bnb.text("W").next(optionalBaserunningAddOn).node("Walk");

const fieldersChoice = bnb
  .text("FC")
  .next(fielders.or(bnb.ok(null)))
  .node("Fielders Choice");

const interference = bnb
  .text("C/")
  .next(bnb.text("E").next(fielder).node("Interference"));

const doubleplay = bnb
  .all(fielders, base.wrap(bnb.text("("), bnb.text(")")), fielders)
  .node("Double Play");

const foulFlyError = bnb
  .text("FLE")
  .next(fielder)
  .node("Error on foul fly ball");

const basicPlay = bnb
  .choice(
    foulFlyError,
    np,
    baserunning,
    fieldersChoice,
    error,
    doubleplay,
    out,
    walk,
    hbp,
    hit,
    strikeout,
    intentionalWalk,
    interference
  )
  .node("Basic Play");
export type BasicPlay = ReturnType<typeof basicPlay["tryParse"]>;

const hitLocation = bnb
  .all(
    fielder
      .or(bnb.text("0").node("Unknown location"))
      .repeat(1, 2)
      .map((f) => f.map((a) => a.value)),
    bnb
      .text("L")
      .or(bnb.ok(null))
      .map((v) => !!!v),
    bnb
      .text("M")
      .map(() => "medium")
      .or(bnb.text("X").map(() => "extra"))
      .or(bnb.ok(null)),
    bnb
      .text("D")
      .map(() => "deep")
      .or(bnb.text("S").map(() => "shallow"))
      .or(bnb.ok(null)),
    bnb
      .text("F")
      .map(() => "Foul")
      .or(bnb.ok(null)),
    bnb.text("+").or(bnb.text("-")).or(bnb.ok(null))
  )
  .map(([fieldLocation, towardTheLine, severity, depth, foul]) => {
    return {
      fieldLocation: fieldLocation.join("-"),
      towardTheLine,
      severity,
      depth,
      foul,
      desc: [severity, depth, fieldLocation.join("-"), foul && "(foul)"]
        .filter((s) => s)
        .join(" "),
    };
  })
  .node("Hit Location");

const modifier = bnb
  .choice(
    bnb.text("AP").node("Appeal Play"),
    bnb.text("BGDP").node("bunt grounded into double play"),
    bnb.text("BG").node("ground ball bunt"),
    bnb.text("BINT").node("batter interference"),
    bnb.text("BL").node("line drive bunt"),
    bnb.text("BOOT").node("batting out of turn"),
    bnb.text("BPDP").node("bunt popped into double play"),
    bnb.text("BP").node("bunt pop up"),
    bnb.text("BR").node("runner hit by batted ball"),
    bnb.text("COUB").node("courtesy batter"),
    bnb.text("COUF").node("courtesy fielder"),
    bnb.text("COUR").node("courtesy runner"),
    bnb.text("C").node("called third strike"),
    bnb.text("DP").node("Double play"),
    bnb.text("E").next(fielder).node("error"),
    bnb.text("FDP").node("fly ball double play"),
    bnb.text("FINT").node("fan interference"),
    bnb.text("FL").node("foul"),
    bnb.text("FO").node("force out"),
    bnb.text("F").node("fly"),
    bnb.text("GDP").node("ground ball double play"),
    bnb.text("GTP").node("ground ball triple play"),
    bnb.text("G").node("ground ball"),
    bnb.text("IF").node("infield fly rule"),
    bnb.text("INT").node("interference"),
    bnb.text("IPHR").node("inside the park home run"),
    bnb.text("LDP").node("lined into double play"),
    bnb.text("LTP").node("lined into triple play"),
    bnb.text("L").node("line drive"),
    bnb.text("MREV").node("manager challenge of call on the field"),
    bnb.text("NDP").node("no double play credited for this play"),
    bnb.text("OBS").node("obstruction (fielder obstructing a runner)"),
    bnb.text("PASS").node("a runner passed another runner and was called out"),
    bnb.text("P").node("pop fly"),
    bnb.text("RINT").node("runner interference"),
    bnb
      .text("R")
      .next(fielder)
      .node("relay throw from the initial fielder to $ with no out made"),
    bnb.text("SF").node("sacrifice fly"),
    bnb.text("SH").node("sacrifice hit (bunt)"),
    bnb.text("TH").next(base).node("throw to base %"),
    bnb.text("TH").node("throw"),
    bnb.text("TP").node("Triple play"),
    bnb.text("UINT").node("umpire interference"),
    bnb.text("UREV").node("umpire review of call on the field")
  )
  .and(hitLocation.or(bnb.ok(null)))
  .node("Modifier");
const modifiers = bnb
  .text("/")
  .next(modifier.sepBy(bnb.text("/")))
  .or(bnb.ok<ReturnType<typeof modifier["tryParse"]>[]>([]));

const advancement = bnb
  .choice(
    bnb
      .all(
        base.skip(bnb.text("-")),
        base,
        error.wrap(bnb.text("("), bnb.text(")")).or(bnb.ok(null))
      )
      .node("Successful Advancement"),
    bnb
      .all(
        base.skip(bnb.text("X")),
        base,
        error.or(fielders).wrap(bnb.text("("), bnb.text(")")).or(bnb.ok(null))
      )
      .node("Failed Advancement")
  )
  .node("Advancement");

const play = bnb
  .all(
    basicPlay,
    modifiers,
    bnb
      .text(".")
      .next(advancement.sepBy(bnb.text(";")))
      .or(bnb.ok<ReturnType<typeof advancement["tryParse"]>[]>([]))
  )
  .node("Play");

export type Play = ReturnType<typeof play["tryParse"]>;

export type NodesIn<T> = T extends bnb.ParseNode<string, infer V>
  ? NodesIn<V> | T
  : T extends Array<infer Q>
  ? NodesIn<Q>
  : never;

type Modifier = ReturnType<typeof modifier["tryParse"]>["value"];
export type Modifiers = NodesIn<Modifier>;
export type BasicPlays = NodesIn<BasicPlay>;
export type Plays = NodesIn<Play>;
export type NodeNames = Plays["name"];

export function parsePlay(
  playString: string
): (bnb.ParseFail & { source: string }) | bnb.ParseOK<Play> {
  const ret = play.parse(playString);
  if (ret.type === "ParseFail") {
    return { ...ret, source: playString };
  }
  return ret;
}

export function mustParsePlay(playString: string) {
  return play.tryParse(playString);
}

export function playIsScoring({ value }: Play): boolean {
  const [{ value: play }, , advancements] = value;

  return (
    (play.name === "Hit" && play.value.name.includes("Home Run")) ||
    !!advancements.find(
      (a) =>
        a.value.name === "Successful Advancement" &&
        (a.value.value[1].value === "Home" ||
          (Array.isArray(a.value.value[1].value) &&
            a.value.value[1].value[0] === "Home"))
    )
  );
}
