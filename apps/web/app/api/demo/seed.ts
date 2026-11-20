import type PocketBase from "pocketbase";
import { q } from "../../../lib/pocketbase/config";

// Demo account seed (FR-55), ported from the seed_demo SQL function. Replaces the parent's data with one
// child, "Demo Fox", twelve synthetic sessions over four weeks and six missions. Pass the superuser client
// (lib/pocketbase/admin.ts). Deleting the children also deletes their sessions and missions (cascade).
// ALL VALUES ARE SYNTHETIC: nothing here comes from a real child.

const DAYS = [27, 25, 23, 20, 18, 16, 13, 11, 9, 6, 4, 2];
const SHORT = 5; // this session ended early and scores insufficient_data

// Whole-day offset from today (UTC) at hh:mm, as an ISO string.
function daysAgoAt(days: number, hour: number, minute: number, now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, hour, minute)).toISOString();
}

const round = (value: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

export async function seedDemo(pb: PocketBase, parentId: string, now: Date = new Date()): Promise<number> {
  const old = await pb.collection("children").getFullList({ filter: `parent = ${q(parentId)}`, fields: "id" });
  for (const c of old) await pb.collection("children").delete(c.id);

  const child = await pb.collection("children").create({ parent: parentId, nickname: "Demo Fox", birth_year: 2018 });

  for (let i = 1; i <= DAYS.length; i++) {
    const id = crypto.randomUUID();
    const full = i !== SHORT;
    const mean = round(520 + 30 * Math.sin(i * 1.7));
    const sd = round(140 + 15 * Math.sin(i * 1.1));

    await pb.collection("sessions").create({
      id,
      child: child.id,
      parent: parentId,
      started_at: daysAgoAt(DAYS[i - 1]!, 16, 30, now),
      duration_ms: full ? 300000 : 60000,
      task: {
        type: "go_nogo",
        version: "0.1.0",
        blocks: 3,
        go_probability: 0.8,
        stimulus_ms: 500,
        isi_ms_min: 900,
        isi_ms_max: 1500,
        calibration_trials: 10,
      },
      device: {
        user_agent: "synthetic-demo-agent",
        pointer_type: "touch",
        screen_w: 1024,
        screen_h: 768,
        device_pixel_ratio: 1,
        est_refresh_hz: 60,
        cross_origin_isolated: false,
        timer_clock: "event.timeStamp",
      },
      calibration: { median_rt_ms: mean - 40, n: 10 },
      off_target_taps: [],
      schema_version: "1.0",
      trials: [],
      play_link: "",
      score: {
        schema_version: "1.0",
        session_id: id,
        scoring_method: "rules_v0",
        validated: false,
        indicators: {
          omission_rate: round(0.06 + 0.02 * Math.sin(i * 1.3), 3),
          commission_rate: round(0.22 + 0.04 * Math.sin(i * 2.3), 3),
          rt_mean_ms: mean,
          rt_sd_ms: sd,
          rt_cv: round(sd / mean, 3),
          vigilance_change: round(0.08 + 0.03 * Math.sin(i * 0.9), 3),
          off_target_tap_rate: round(0.12 + 0.03 * Math.sin(i * 1.5), 3),
        },
        flags: full ? ["high_rt_variability", "high_commission_rate"] : [],
        band: full ? "follow_up_suggested" : "insufficient_data",
        data_quality: { n_trials: full ? 144 : 30, pct_anticipations: 0.01, notes: [] },
        reasons: full
          ? ["Response speed varied more than expected during the watch.", "Tapped often when the game asked to wait."]
          : [],
        recommendations: [],
        disclaimer: "Attention profile from a game. Not a diagnosis. Talk to a healthcare professional.",
      },
    });
  }

  // Six parent-chosen missions over the 4 weeks, the first four done (keys from apps/web/lib/missions.ts).
  for (let m = 1; m <= 6; m++) {
    const done = m <= 4;
    await pb.collection("missions").create({
      child: child.id,
      parent: parentId,
      mission_key: `wellbeing_0${m}`,
      chosen_by: "parent",
      status: done ? "done" : "todo",
      created_at: daysAgoAt(28 - 4 * m, 19, 0, now),
      done_at: done ? daysAgoAt(28 - 4 * m - 2, 19, 0, now) : null,
    });
  }

  return DAYS.length;
}
