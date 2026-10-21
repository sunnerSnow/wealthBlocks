import { AVATAR_LABEL, Avatar } from "@/components/avatar";
import { AGE_BANDS, AGE_BAND_LABEL, AVATARS } from "@/lib/game/input";

/** 孩子檔案的欄位：只問暱稱、年齡區間與頭像顏色（規格 6.4：只收必要資訊） */
export function ChildFields({
  prefix = "",
  errors = {},
  values = {},
}: {
  prefix?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}) {
  const err = (key: string) => errors[`${prefix}${key}`];
  const val = (key: string) => values[`${prefix}${key}`];
  return (
    <>
      <label className="field">
        <span>
          孩子的暱稱<small>用暱稱就好，不需要真實姓名</small>
        </span>
        <input
          className="input"
          name={`${prefix}displayName`}
          maxLength={12}
          required
          autoComplete="off"
          defaultValue={val("displayName")}
          aria-invalid={Boolean(err("displayName"))}
        />
        {err("displayName") ? <span className="field-error">{err("displayName")}</span> : null}
      </label>
      <fieldset className="fieldset">
        <legend>年齡區間</legend>
        <div className="tiles">
          {AGE_BANDS.map((band) => (
            <label key={band} className="tile">
              <input type="radio" name={`${prefix}ageBand`} value={band} required defaultChecked={band === (val("ageBand") ?? "9-10")} />
              {AGE_BAND_LABEL[band]}
            </label>
          ))}
        </div>
        {err("ageBand") ? <span className="field-error">{err("ageBand")}</span> : null}
      </fieldset>
      <fieldset className="fieldset">
        <legend>頭像顏色</legend>
        <div className="tiles">
          {AVATARS.map((key) => (
            <label key={key} className="tile">
              <input type="radio" name={`${prefix}avatarKey`} value={key} defaultChecked={key === (val("avatarKey") ?? "sun")} />
              <Avatar avatarKey={key} />
              {AVATAR_LABEL(key)}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
