"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { parseCookiePreferences, readCookiePreferencesValue, subscribeCookiePreferences, writeCookiePreferences } from "@/lib/cookie-consent";

export function CookieConsent() {
  const consentValue = useSyncExternalStore(subscribeCookiePreferences, () => readCookiePreferencesValue(), () => null);
  const preferences = parseCookiePreferences(consentValue);
  const [reopened, setReopened] = useState(false);
  const open = !preferences || reopened;
  const [customizing, setCustomizing] = useState(false);
  const [allowPreferences, setAllowPreferences] = useState(false);
  const [allowAnalytics, setAllowAnalytics] = useState(false);

  useEffect(() => {
    if (!preferences?.preferences) window.localStorage.removeItem("product-vault-theme");
  }, [preferences?.preferences]);

  function save(nextPreferences: boolean, nextAnalytics: boolean) {
    writeCookiePreferences(nextPreferences, nextAnalytics);
    setAllowPreferences(nextPreferences);
    setAllowAnalytics(nextAnalytics);
    setReopened(false);
    setCustomizing(false);
  }

  return (
    <>
      {preferences && !open && <button className="cookie-settings-launcher" type="button" onClick={() => { setAllowPreferences(preferences.preferences); setAllowAnalytics(preferences.analytics); setReopened(true); setCustomizing(true); }}><Settings2 size={15} /> Cookie settings</button>}
      {open && <div className="cookie-consent-backdrop">
        <section className="cookie-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
          <div className="cookie-consent-heading"><span className="cookie-consent-icon"><Cookie size={19} /></span><div><p className="cookie-consent-eyebrow">YOUR PRIVACY</p><h2 id="cookie-consent-title">Cookie preferences</h2></div>
            {preferences && <button className="cookie-consent-close" type="button" aria-label="Close cookie preferences" onClick={() => setReopened(false)}><X size={17} /></button>}
          </div>
          <p id="cookie-consent-description" className="cookie-consent-copy">ProductVault uses essential cookies to keep sign-in and security working. Choose whether to allow optional preferences and analytics storage.</p>
          <div className="cookie-consent-categories">
            <div className="cookie-consent-category">
              <div><strong><ShieldCheck size={15} /> Necessary</strong><p>Sign-in session, security, and saving your cookie choice. Always active.</p></div>
              <input aria-label="Necessary cookies" type="checkbox" checked disabled readOnly />
            </div>
            {customizing && <>
              <label className="cookie-consent-category">
                <span><strong>Preferences</strong><p>Remember choices such as your display theme on this device.</p></span>
                <input aria-label="Preferences cookies" type="checkbox" checked={allowPreferences} onChange={(event) => setAllowPreferences(event.target.checked)} />
              </label>
              <label className="cookie-consent-category">
                <span><strong>Analytics</strong><p>Optional usage measurement. No analytics provider is connected in this MVP.</p></span>
                <input aria-label="Analytics cookies" type="checkbox" checked={allowAnalytics} onChange={(event) => setAllowAnalytics(event.target.checked)} />
              </label>
            </>}
          </div>
          <div className="cookie-consent-actions">
            <button className="cookie-consent-secondary" type="button" onClick={() => save(false, false)}>Reject optional</button>
            {customizing ? <button className="cookie-consent-secondary" type="button" onClick={() => save(allowPreferences, allowAnalytics)}>Save choices</button> : <button className="cookie-consent-secondary" type="button" onClick={() => setCustomizing(true)}>Customize</button>}
            <button className="cookie-consent-primary" type="button" onClick={() => save(true, true)}>Accept all</button>
          </div>
          <p className="cookie-consent-footnote">You can reopen these settings any time. Necessary sign-in cookies cannot be turned off while using an account.</p>
        </section>
      </div>}
    </>
  );
}
