/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run `node --experimental-strip-types scripts/gen-lattice-plate.ts` to rebuild
 * it; the generator carries the reasoning behind every constant here, and its
 * output is deterministic, so an unexplained diff in this file means the source
 * geometry moved.
 *
 * A 2×2×2 FCC block — 63 atoms, 240 nearest-neighbour bonds —
 * projected at yaw 36°, pitch 35°, with one unit cell picked out in dashes.
 *
 * The SVG is inline rather than an <img> so it inherits the page's custom
 * properties and follows the light/dark theme. Every colour is a var() with a
 * dark-theme fallback:
 *
 *   --plate-bg, --plate-atom-a, --plate-atom-a-hi, --plate-atom-b,
 *   --plate-atom-b-hi, --plate-bond, --plate-cell, --plate-shadow
 *
 * Decorative: the figure's caption carries the meaning, so the svg is hidden
 * from assistive technology.
 */
export function LatticePlate() {
  // Sizing lives in the style, not in width/height attributes: those take SVG
  // lengths and "auto" is not one, so the attribute form logs
  // 'Expected length, "auto"' to the console on every load. The style does the
  // job, and the intrinsic ratio comes from the viewBox either way.
  return (
    <svg
      viewBox="0 0 677 722"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="lp-a0" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-a-hi, #a8c3dc)" stopOpacity="0.97" />
          <stop offset="0.26" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="1" />
          <stop offset="0.72" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.94" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.88" />
        </radialGradient>
        <radialGradient id="lp-a1" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-a-hi, #a8c3dc)" stopOpacity="0.84" />
          <stop offset="0.26" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.89" />
          <stop offset="0.72" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.84" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.74" />
        </radialGradient>
        <radialGradient id="lp-a2" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-a-hi, #a8c3dc)" stopOpacity="0.71" />
          <stop offset="0.26" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.78" />
          <stop offset="0.72" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.73" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.61" />
        </radialGradient>
        <radialGradient id="lp-a3" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-a-hi, #a8c3dc)" stopOpacity="0.58" />
          <stop offset="0.26" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.67" />
          <stop offset="0.72" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.63" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.47" />
        </radialGradient>
        <radialGradient id="lp-a4" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-a-hi, #a8c3dc)" stopOpacity="0.46" />
          <stop offset="0.26" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.56" />
          <stop offset="0.72" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.53" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.34" />
        </radialGradient>
        <radialGradient id="lp-a5" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-a-hi, #a8c3dc)" stopOpacity="0.33" />
          <stop offset="0.26" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.45" />
          <stop offset="0.72" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.42" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="lp-a6" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-a-hi, #a8c3dc)" stopOpacity="0.2" />
          <stop offset="0.26" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.34" />
          <stop offset="0.72" stopColor="var(--plate-atom-a, #4a6f96)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.07" />
        </radialGradient>
        <radialGradient id="lp-b0" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-b-hi, #dcb28a)" stopOpacity="0.66" />
          <stop offset="0.2" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.9" />
          <stop offset="0.66" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.88" />
        </radialGradient>
        <radialGradient id="lp-b1" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-b-hi, #dcb28a)" stopOpacity="0.57" />
          <stop offset="0.2" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.8" />
          <stop offset="0.66" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.74" />
        </radialGradient>
        <radialGradient id="lp-b2" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-b-hi, #dcb28a)" stopOpacity="0.49" />
          <stop offset="0.2" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.7" />
          <stop offset="0.66" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.66" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.61" />
        </radialGradient>
        <radialGradient id="lp-b3" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-b-hi, #dcb28a)" stopOpacity="0.4" />
          <stop offset="0.2" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.6" />
          <stop offset="0.66" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.57" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.47" />
        </radialGradient>
        <radialGradient id="lp-b4" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-b-hi, #dcb28a)" stopOpacity="0.31" />
          <stop offset="0.2" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.5" />
          <stop offset="0.66" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.47" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.34" />
        </radialGradient>
        <radialGradient id="lp-b5" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-b-hi, #dcb28a)" stopOpacity="0.22" />
          <stop offset="0.2" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.41" />
          <stop offset="0.66" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.38" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="lp-b6" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">
          <stop offset="0" stopColor="var(--plate-atom-b-hi, #dcb28a)" stopOpacity="0.14" />
          <stop offset="0.2" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.31" />
          <stop offset="0.66" stopColor="var(--plate-atom-b, #a86a3c)" stopOpacity="0.29" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.07" />
        </radialGradient>
        <radialGradient id="lp-contact" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--plate-shadow, rgba(11, 11, 11, 0.14))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="677" height="722" fill="var(--plate-bg, #ffffff)" />
      <ellipse cx="338.7" cy="656" rx="353.5" ry="50.7" fill="url(#lp-contact)" />
      <g stroke="var(--plate-bond, #918f86)" strokeLinecap="round" fill="none">
        <g strokeWidth="1.63" strokeOpacity="0.13">
          <line x1="350.6" y1="388.1" x2="365.9" y2="397.7" />
          <line x1="337.7" y1="357.4" x2="340.5" y2="344" />
          <line x1="315.6" y1="387.1" x2="308.2" y2="391.1" />
          <line x1="413.2" y1="356" x2="387.3" y2="393.3" />
          <line x1="403.7" y1="335.3" x2="358.9" y2="330.7" />
          <line x1="372.4" y1="391.9" x2="350.1" y2="343" />
          <line x1="343.5" y1="456.3" x2="370.1" y2="418.1" />
          <line x1="363.7" y1="404.4" x2="310.1" y2="399.8" />
          <line x1="335" y1="341.6" x2="303.6" y2="386" />
          <line x1="320.9" y1="454.4" x2="301.3" y2="412.4" />
          <line x1="281.5" y1="322.8" x2="328.6" y2="327.6" />
          <line x1="268.2" y1="341.6" x2="288.3" y2="384.6" />
        </g>
        <g strokeWidth="1.9" strokeOpacity="0.2">
          <line x1="446.6" y1="346.4" x2="472.3" y2="357.6" />
          <line x1="434.4" y1="316.8" x2="443.6" y2="294.3" />
          <line x1="412.4" y1="345.7" x2="410.1" y2="347.2" />
          <line x1="413.7" y1="427.6" x2="391.5" y2="413.7" />
          <line x1="383.7" y1="391.4" x2="390.8" y2="371.5" />
          <line x1="357.4" y1="335.9" x2="381.2" y2="347.7" />
          <line x1="355.7" y1="423.2" x2="366.7" y2="414.8" />
          <line x1="347.8" y1="490.1" x2="368.7" y2="508.3" />
          <line x1="351.5" y1="293.2" x2="347" y2="314.3" />
          <line x1="335.8" y1="456.1" x2="337.3" y2="450.4" />
          <line x1="317.6" y1="339.6" x2="329.6" y2="334.8" />
          <line x1="328.1" y1="423.4" x2="307.1" y2="407.7" />
          <line x1="313.3" y1="490.1" x2="299.3" y2="502.4" />
          <line x1="299.2" y1="363.5" x2="296.7" y2="383.3" />
          <line x1="278.1" y1="332.2" x2="286.3" y2="337.1" />
          <line x1="267.6" y1="413.4" x2="281.3" y2="405.9" />
          <line x1="258.9" y1="297.2" x2="259.5" y2="274.2" />
          <line x1="235.9" y1="326.8" x2="219.1" y2="331.5" />
          <line x1="525" y1="309.5" x2="497.2" y2="350.4" />
          <line x1="514.3" y1="286.1" x2="466.8" y2="280.6" />
          <line x1="481" y1="348.9" x2="456.8" y2="294.1" />
          <line x1="449.6" y1="420" x2="478.3" y2="378" />
          <line x1="413.6" y1="357" x2="471" y2="362.6" />
          <line x1="406.3" y1="341.3" x2="440.3" y2="292.5" />
          <line x1="424.8" y1="417.9" x2="403.6" y2="370.9" />
          <line x1="420.9" y1="462" x2="391.3" y2="505.4" />
          <line x1="382.8" y1="270.8" x2="433.1" y2="276.7" />
          <line x1="409.9" y1="439.1" x2="359.2" y2="435.1" />
          <line x1="367.7" y1="291.5" x2="389.5" y2="339.7" />
          <line x1="351.8" y1="419.5" x2="386.7" y2="369.4" />
          <line x1="374.5" y1="504" x2="349.2" y2="449.5" />
          <line x1="341.5" y1="578.3" x2="372" y2="533.7" />
          <line x1="318.8" y1="347.8" x2="379.5" y2="353.7" />
          <line x1="364.6" y1="518.5" x2="303.6" y2="514.9" />
          <line x1="341.9" y1="289" x2="311.5" y2="331.8" />
          <line x1="334.7" y1="418" x2="308.7" y2="362" />
          <line x1="332" y1="448" x2="296.1" y2="499.5" />
          <line x1="315.7" y1="576.3" x2="293.6" y2="529.7" />
          <line x1="331.2" y1="264.8" x2="277.5" y2="258.6" />
          <line x1="270.9" y1="428.2" x2="324.7" y2="432.4" />
          <line x1="294" y1="330.2" x2="267.3" y2="272.6" />
          <line x1="259.8" y1="404.5" x2="291.2" y2="360.4" />
          <line x1="255.8" y1="450.1" x2="278.6" y2="498.1" />
        </g>
        <g strokeWidth="2.16" strokeOpacity="0.28">
          <line x1="283.9" y1="344.4" x2="219.7" y2="338.2" />
          <line x1="249.5" y1="270.8" x2="212.4" y2="321.9" />
          <line x1="233.1" y1="402.1" x2="209.6" y2="352.6" />
          <line x1="540.4" y1="386.9" x2="503.1" y2="370.8" />
          <line x1="185.3" y1="247.9" x2="242.3" y2="254.5" />
          <line x1="496.2" y1="349.7" x2="514.8" y2="317.7" />
          <line x1="170" y1="269.2" x2="194.2" y2="320.3" />
          <line x1="466.2" y1="283.5" x2="506" y2="295.5" />
          <line x1="475.1" y1="377.6" x2="477" y2="375.6" />
          <line x1="456.8" y1="454.5" x2="491.4" y2="476.1" />
          <line x1="470.3" y1="228.6" x2="456.3" y2="262.9" />
          <line x1="447.7" y1="418.8" x2="454.8" y2="406.1" />
          <line x1="433.8" y1="284.3" x2="436.2" y2="283.5" />
          <line x1="411.9" y1="362.9" x2="446.9" y2="380.3" />
          <line x1="420.3" y1="458.6" x2="415.6" y2="464.1" />
          <line x1="425.3" y1="557.4" x2="394.6" y2="530.8" />
          <line x1="402.3" y1="339.2" x2="413.3" y2="307.9" />
          <line x1="389.6" y1="504.4" x2="393.6" y2="496.7" />
          <line x1="381.6" y1="276.2" x2="401.2" y2="282.8" />
          <line x1="375.2" y1="368.2" x2="381.9" y2="364.2" />
          <line x1="355.8" y1="444.1" x2="386.9" y2="467.3" />
          <line x1="370.9" y1="532.9" x2="352.2" y2="556" />
          <line x1="362.5" y1="242.4" x2="370.2" y2="206.6" />
          <line x1="350.1" y1="404.3" x2="346.5" y2="417" />
          <line x1="332.7" y1="586.8" x2="333.7" y2="584.6" />
          <line x1="335.4" y1="271.9" x2="330" y2="273" />
          <line x1="331.4" y1="364" x2="316.4" y2="355" />
          <line x1="308.5" y1="459.2" x2="328.2" y2="444.3" />
          <line x1="325.9" y1="556.9" x2="298" y2="526.7" />
          <line x1="303.5" y1="328.7" x2="307.5" y2="297" />
          <line x1="289.5" y1="491" x2="288.7" y2="496.6" />
          <line x1="276.3" y1="263.2" x2="291.2" y2="269.2" />
          <line x1="263.1" y1="361.3" x2="285.1" y2="352.6" />
          <line x1="263.7" y1="444.4" x2="277.6" y2="457.6" />
          <line x1="249.3" y1="546" x2="272.9" y2="525.4" />
          <line x1="261.2" y1="202.6" x2="260.3" y2="238.8" />
          <line x1="244.3" y1="399.8" x2="244.2" y2="389.6" />
          <line x1="215.1" y1="261.4" x2="242.3" y2="258.5" />
          <line x1="227.7" y1="356.4" x2="216.1" y2="347.4" />
          <line x1="221.2" y1="438.9" x2="194.5" y2="453.6" />
          <line x1="555.3" y1="372" x2="532.2" y2="318.8" />
          <line x1="550.8" y1="422.1" x2="518.5" y2="470.3" />
          <line x1="196.5" y1="284.5" x2="200.1" y2="318.6" />
          <line x1="538.1" y1="395.7" x2="483.9" y2="390.8" />
          <line x1="174.9" y1="253.5" x2="177.8" y2="255" />
          <line x1="155.6" y1="349.5" x2="184.7" y2="341.3" />
          <line x1="493" y1="228.4" x2="516.9" y2="283.3" />
          <line x1="475.5" y1="372.8" x2="513.6" y2="317" />
          <line x1="499.9" y1="468.7" x2="472.4" y2="406.9" />
          <line x1="463.8" y1="552.3" x2="497" y2="502.5" />
          <line x1="439.7" y1="291.4" x2="505.3" y2="298.9" />
          <line x1="422.5" y1="480.5" x2="488.5" y2="485.1" />
          <line x1="464.5" y1="225.5" x2="431.3" y2="273" />
          <line x1="456.4" y1="371.1" x2="428" y2="307.3" />
          <line x1="414" y1="462.8" x2="453.4" y2="405.2" />
          <line x1="435.2" y1="550" x2="411" y2="497.2" />
          <line x1="452.3" y1="197.5" x2="394.3" y2="189.7" />
          <line x1="387" y1="382" x2="444.9" y2="387.2" />
          <line x1="418.1" y1="575.3" x2="359.6" y2="572.6" />
          <line x1="411.9" y1="271.1" x2="382.6" y2="205.3" />
          <line x1="374.2" y1="354.6" x2="408.6" y2="305.5" />
          <line x1="369.5" y1="406.6" x2="394.5" y2="461.1" />
          <line x1="350.9" y1="555.1" x2="391.6" y2="495.5" />
          <line x1="330.3" y1="279.1" x2="400.3" y2="287" />
        </g>
        <g strokeWidth="2.43" strokeOpacity="0.35">
          <line x1="312.7" y1="473" x2="383" y2="477.8" />
          <line x1="321.9" y1="260.3" x2="362.7" y2="203.3" />
          <line x1="344.4" y1="351.9" x2="318.5" y2="295.3" />
          <line x1="339.7" y1="403.9" x2="304" y2="454.9" />
          <line x1="301" y1="490" x2="331" y2="553.5" />
          <line x1="292.5" y1="175.9" x2="354.5" y2="184.3" />
          <line x1="327" y1="376.5" x2="264.5" y2="370.8" />
          <line x1="256.9" y1="567.8" x2="319.5" y2="570.7" />
          <line x1="274.8" y1="199.8" x2="301.6" y2="258.3" />
          <line x1="256" y1="352.2" x2="298.2" y2="293.3" />
          <line x1="283.7" y1="453.2" x2="252.8" y2="387.6" />
          <line x1="243.8" y1="541" x2="280.7" y2="488.2" />
          <line x1="215.1" y1="266.1" x2="289.9" y2="274.5" />
          <line x1="272.1" y1="470.2" x2="197" y2="465" />
          <line x1="243.7" y1="196.6" x2="206.8" y2="246.9" />
          <line x1="235.2" y1="350.3" x2="203.3" y2="282.6" />
          <line x1="232" y1="385.7" x2="188.4" y2="446.6" />
          <line x1="212.6" y1="538.6" x2="185.3" y2="482.4" />
          <line x1="561.3" y1="414.7" x2="560.3" y2="417.5" />
          <line x1="575.5" y1="528.7" x2="524.2" y2="496.6" />
          <line x1="156.6" y1="361" x2="223.5" y2="367.1" />
          <line x1="520.7" y1="472" x2="539.7" y2="450.9" />
          <line x1="143.8" y1="332.6" x2="182.1" y2="280.5" />
          <line x1="138.9" y1="386.7" x2="167.1" y2="444.8" />
          <line x1="513.6" y1="310.1" x2="515.2" y2="308.8" />
          <line x1="482" y1="397.7" x2="534.5" y2="423.7" />
          <line x1="500" y1="504.1" x2="493.5" y2="518.8" />
          <line x1="487.3" y1="348.2" x2="474" y2="371.9" />
          <line x1="464.3" y1="559.8" x2="467.8" y2="556.4" />
          <line x1="467.9" y1="200.1" x2="465.6" y2="199.8" />
          <line x1="471.3" y1="306.7" x2="438.7" y2="295.6" />
          <line x1="446.8" y1="407.8" x2="451" y2="403.3" />
          <line x1="418.6" y1="491" x2="465.6" y2="526.1" />
          <line x1="426.6" y1="270.5" x2="444.3" y2="220.6" />
          <line x1="411.9" y1="461.6" x2="420.8" y2="444.6" />
          <line x1="394.3" y1="189.9" x2="428.9" y2="195" />
          <line x1="397.2" y1="297.3" x2="401.3" y2="295.8" />
          <line x1="382.8" y1="394.6" x2="411.5" y2="411.7" />
          <line x1="378" y1="508.2" x2="389.9" y2="494.3" />
          <line x1="390.9" y1="110.6" x2="378.7" y2="167.4" />
          <line x1="365" y1="350.2" x2="371.4" y2="327.1" />
          <line x1="349" y1="550.7" x2="347.6" y2="553.8" />
          <line x1="346.2" y1="183.7" x2="354.5" y2="184.7" />
          <line x1="328.9" y1="284.4" x2="355.6" y2="295.2" />
          <line x1="331.2" y1="394.8" x2="321.8" y2="400.5" />
          <line x1="331" y1="508.2" x2="307.1" y2="485.6" />
          <line x1="312.6" y1="256.6" x2="319.1" y2="205" />
          <line x1="295.3" y1="451.5" x2="297.5" y2="437" />
          <line x1="289.6" y1="176" x2="298.2" y2="177.3" />
          <line x1="274.1" y1="283.7" x2="290.1" y2="280.6" />
          <line x1="260.3" y1="381.6" x2="281.9" y2="398.2" />
          <line x1="276.2" y1="483.9" x2="241.5" y2="510.4" />
          <line x1="243.7" y1="326.1" x2="243.9" y2="348.4" />
          <line x1="224.2" y1="547.5" x2="223.8" y2="544.2" />
          <line x1="220.9" y1="277.7" x2="212.9" y2="273.4" />
          <line x1="185.4" y1="392.4" x2="224.9" y2="376.6" />
          <line x1="207.3" y1="505.6" x2="188.6" y2="480.4" />
          <line x1="590.7" y1="515.7" x2="564.1" y2="454.8" />
          <line x1="167.7" y1="426" x2="171.6" y2="443.3" />
          <line x1="570.5" y1="544.8" x2="507.3" y2="541.3" />
          <line x1="142.1" y1="378.2" x2="145.9" y2="382.6" />
          <line x1="111.7" y1="499" x2="157.9" y2="473.6" />
          <line x1="518.2" y1="349.7" x2="545.8" y2="412.9" />
          <line x1="497" y1="520.7" x2="542.3" y2="452.9" />
          <line x1="455.2" y1="425.7" x2="532.2" y2="432" />
        </g>
        <g strokeWidth="2.69" strokeOpacity="0.43">
          <line x1="490.3" y1="286" x2="461.5" y2="220" />
          <line x1="484.6" y1="346.5" x2="445" y2="404.4" />
          <line x1="441.4" y1="445.2" x2="474.6" y2="518.8" />
          <line x1="469.7" y1="314.1" x2="401.4" y2="306.7" />
          <line x1="392.7" y1="534.9" x2="461" y2="538.7" />
          <line x1="412.8" y1="108.4" x2="442.7" y2="176.9" />
          <line x1="391.5" y1="284.6" x2="438.6" y2="217.7" />
          <line x1="422" y1="402.3" x2="387.5" y2="325.9" />
          <line x1="377.2" y1="503.3" x2="418.4" y2="443.2" />
          <line x1="346.1" y1="184.2" x2="428.8" y2="195.3" />
          <line x1="325.2" y1="415" x2="408.3" y2="421.8" />
          <line x1="377.4" y1="104.6" x2="336.3" y2="161.3" />
          <line x1="367.9" y1="282.4" x2="332.1" y2="203" />
          <line x1="315" y1="393.2" x2="364" y2="323.6" />
          <line x1="341.8" y1="500.4" x2="311.3" y2="435" />
          <line x1="280.1" y1="293.5" x2="354" y2="301.6" />
          <line x1="321.2" y1="530.9" x2="246.5" y2="526.7" />
          <line x1="265" y1="259.7" x2="307.9" y2="200.5" />
          <line x1="259" y1="323" x2="290.8" y2="391.1" />
          <line x1="236.1" y1="505.2" x2="287.1" y2="432.8" />
          <line x1="187.1" y1="403.7" x2="276.9" y2="411.1" />
          <line x1="221.7" y1="319.4" x2="176.8" y2="381.4" />
          <line x1="173" y1="424.1" x2="211.2" y2="503.2" />
          <line x1="116.3" y1="519.5" x2="197.4" y2="524" />
          <line x1="100.6" y1="486.5" x2="147.5" y2="421.9" />
          <line x1="545.5" y1="462.4" x2="547.8" y2="455.6" />
          <line x1="512.9" y1="511.2" x2="500.6" y2="523.6" />
          <line x1="490.3" y1="329.4" x2="487.9" y2="331.4" />
          <line x1="500.9" y1="465" x2="451.9" y2="435.8" />
          <line x1="442.6" y1="402.9" x2="460.6" y2="368.6" />
          <line x1="428.4" y1="196.1" x2="431.9" y2="196.4" />
          <line x1="399.8" y1="313.1" x2="447.1" y2="332.2" />
          <line x1="415.6" y1="440.9" x2="402.7" y2="454.6" />
          <line x1="396.4" y1="236.6" x2="384.1" y2="281.1" />
          <line x1="368.8" y1="506.7" x2="370.8" y2="502.2" />
          <line x1="368.6" y1="188" x2="346.1" y2="184.6" />
          <line x1="342.1" y1="316.7" x2="355.2" y2="312.1" />
          <line x1="320.2" y1="427.9" x2="359.3" y2="458" />
          <line x1="304.6" y1="389.1" x2="309.4" y2="356.4" />
          <line x1="275.8" y1="306.6" x2="287.3" y2="312.7" />
          <line x1="255" y1="440.8" x2="280.3" y2="425.6" />
          <line x1="218.6" y1="492.5" x2="219.5" y2="500.9" />
          <line x1="191.1" y1="435.6" x2="178.4" y2="420.6" />
        </g>
        <g strokeWidth="2.96" strokeOpacity="0.5">
          <line x1="520.2" y1="447.8" x2="485.6" y2="369.4" />
          <line x1="495" y1="483.8" x2="411.9" y2="478.1" />
          <line x1="426" y1="234.4" x2="462.3" y2="316.6" />
          <line x1="399.2" y1="451.8" x2="457.6" y2="366.8" />
          <line x1="343.6" y1="329.7" x2="445.2" y2="340.1" />
          <line x1="382.6" y1="230" x2="331.2" y2="302.3" />
          <line x1="326.3" y1="353.9" x2="370.3" y2="449.3" />
          <line x1="261.6" y1="467.7" x2="353.2" y2="474" />
          <line x1="242.4" y1="427.2" x2="296.4" y2="351.1" />
          <line x1="446.8" y1="365.5" x2="451.7" y2="361.4" />
          <line x1="404.8" y1="426.7" x2="394.7" y2="449.2" />
          <line x1="373.2" y1="358" x2="340.3" y2="340.7" />
        </g>
      </g>
      <g stroke="var(--plate-cell, #2a78d6)" strokeDasharray="10.5 8.1" strokeLinecap="round" fill="none">
        <g strokeWidth="2.26" strokeOpacity="0.4">
          <line x1="357" y1="532.9" x2="537.4" y2="486.8" />
          <line x1="537.4" y1="486.8" x2="504.3" y2="317.9" />
          <line x1="504.3" y1="317.9" x2="357" y2="379.2" />
          <line x1="357" y1="379.2" x2="357" y2="532.9" />
          <line x1="408.1" y1="194" x2="504.3" y2="317.9" />
          <line x1="243.4" y1="289.6" x2="357" y2="379.2" />
        </g>
      </g>
        <circle cx="333.4" cy="377.3" r="23.7" fill="var(--plate-bg, #ffffff)" />
        <circle cx="333.4" cy="377.3" r="23.7" fill="url(#lp-a6)" />
        <circle cx="426" cy="337.6" r="26.06" fill="var(--plate-bg, #ffffff)" />
        <circle cx="426" cy="337.6" r="26.06" fill="url(#lp-a5)" />
        <circle cx="378.7" cy="405.7" r="17.54" fill="var(--plate-bg, #ffffff)" />
        <circle cx="378.7" cy="405.7" r="17.54" fill="url(#lp-b5)" />
        <circle cx="343.8" cy="329.2" r="17.7" fill="var(--plate-bg, #ffffff)" />
        <circle cx="343.8" cy="329.2" r="17.7" fill="url(#lp-b5)" />
        <circle cx="330.5" cy="475.1" r="26.56" fill="var(--plate-bg, #ffffff)" />
        <circle cx="330.5" cy="475.1" r="26.56" fill="url(#lp-a5)" />
        <circle cx="294.8" cy="398.5" r="17.88" fill="var(--plate-bg, #ffffff)" />
        <circle cx="294.8" cy="398.5" r="17.88" fill="url(#lp-b5)" />
        <circle cx="258.3" cy="320.5" r="27.07" fill="var(--plate-bg, #ffffff)" />
        <circle cx="258.3" cy="320.5" r="27.07" fill="url(#lp-a5)" />
        <circle cx="539.1" cy="289" r="28.94" fill="var(--plate-bg, #ffffff)" />
        <circle cx="539.1" cy="289" r="28.94" fill="url(#lp-a4)" />
        <circle cx="487.7" cy="364.2" r="19.5" fill="var(--plate-bg, #ffffff)" />
        <circle cx="487.7" cy="364.2" r="19.5" fill="url(#lp-b4)" />
        <circle cx="450" cy="278.6" r="19.7" fill="var(--plate-bg, #ffffff)" />
        <circle cx="450" cy="278.6" r="19.7" fill="url(#lp-b4)" />
        <circle cx="435.3" cy="441" r="29.56" fill="var(--plate-bg, #ffffff)" />
        <circle cx="435.3" cy="441" r="29.56" fill="url(#lp-a4)" />
        <circle cx="396.5" cy="355.3" r="19.92" fill="var(--plate-bg, #ffffff)" />
        <circle cx="396.5" cy="355.3" r="19.92" fill="url(#lp-b4)" />
        <circle cx="381.7" cy="519.5" r="19.92" fill="var(--plate-bg, #ffffff)" />
        <circle cx="381.7" cy="519.5" r="19.92" fill="url(#lp-b4)" />
        <circle cx="357" cy="267.8" r="30.2" fill="var(--plate-bg, #ffffff)" />
        <circle cx="357" cy="267.8" r="30.2" fill="url(#lp-a4)" />
        <circle cx="341.9" cy="433.7" r="20.14" fill="var(--plate-bg, #ffffff)" />
        <circle cx="341.9" cy="433.7" r="20.14" fill="url(#lp-b4)" />
        <circle cx="326.9" cy="599.8" r="30.22" fill="var(--plate-bg, #ffffff)" />
        <circle cx="326.9" cy="599.8" r="30.22" fill="url(#lp-a4)" />
        <circle cx="301.4" cy="346.1" r="20.36" fill="var(--plate-bg, #ffffff)" />
        <circle cx="301.4" cy="346.1" r="20.36" fill="url(#lp-b4)" />
        <circle cx="286.1" cy="513.9" r="20.36" fill="var(--plate-bg, #ffffff)" />
        <circle cx="286.1" cy="513.9" r="20.36" fill="url(#lp-b4)" />
        <circle cx="259.9" cy="256.5" r="20.58" fill="var(--plate-bg, #ffffff)" />
        <circle cx="259.9" cy="256.5" r="20.58" fill="url(#lp-b4)" />
        <circle cx="244.5" cy="426.1" r="30.88" fill="var(--plate-bg, #ffffff)" />
        <circle cx="244.5" cy="426.1" r="30.88" fill="url(#lp-a4)" />
        <circle cx="201.9" cy="336.4" r="20.81" fill="var(--plate-bg, #ffffff)" />
        <circle cx="201.9" cy="336.4" r="20.81" fill="url(#lp-b4)" />
        <circle cx="158.4" cy="244.7" r="31.57" fill="var(--plate-bg, #ffffff)" />
        <circle cx="158.4" cy="244.7" r="31.57" fill="url(#lp-a4)" />
        <circle cx="566.7" cy="398.3" r="33.33" fill="var(--plate-bg, #ffffff)" />
        <circle cx="566.7" cy="398.3" r="33.33" fill="url(#lp-a3)" />
        <circle cx="524.5" cy="301" r="22.48" fill="var(--plate-bg, #ffffff)" />
        <circle cx="524.5" cy="301" r="22.48" fill="url(#lp-b3)" />
        <circle cx="507.8" cy="486.4" r="22.49" fill="var(--plate-bg, #ffffff)" />
        <circle cx="507.8" cy="486.4" r="22.49" fill="url(#lp-b3)" />
        <circle cx="481.4" cy="201.4" r="34.13" fill="var(--plate-bg, #ffffff)" />
        <circle cx="481.4" cy="201.4" r="34.13" fill="url(#lp-a3)" />
        <circle cx="464.4" cy="389" r="22.76" fill="var(--plate-bg, #ffffff)" />
        <circle cx="464.4" cy="389" r="22.76" fill="url(#lp-b3)" />
        <circle cx="447.4" cy="576.7" r="34.16" fill="var(--plate-bg, #ffffff)" />
        <circle cx="447.4" cy="576.7" r="34.16" fill="url(#lp-a3)" />
        <circle cx="420" cy="289.2" r="23.04" fill="var(--plate-bg, #ffffff)" />
        <circle cx="420" cy="289.2" r="23.04" fill="url(#lp-b3)" />
        <circle cx="402.8" cy="479.2" r="23.05" fill="var(--plate-bg, #ffffff)" />
        <circle cx="402.8" cy="479.2" r="23.05" fill="url(#lp-b3)" />
        <circle cx="374.4" cy="187" r="23.33" fill="var(--plate-bg, #ffffff)" />
        <circle cx="374.4" cy="187" r="23.33" fill="url(#lp-b3)" />
        <circle cx="357" cy="379.2" r="35.01" fill="var(--plate-bg, #ffffff)" />
        <circle cx="357" cy="379.2" r="35.01" fill="url(#lp-a3)" />
        <circle cx="339.5" cy="571.7" r="23.35" fill="var(--plate-bg, #ffffff)" />
        <circle cx="339.5" cy="571.7" r="23.35" fill="url(#lp-b3)" />
        <circle cx="310.1" cy="276.8" r="23.63" fill="var(--plate-bg, #ffffff)" />
        <circle cx="310.1" cy="276.8" r="23.63" fill="url(#lp-b3)" />
        <circle cx="292.4" cy="471.6" r="23.64" fill="var(--plate-bg, #ffffff)" />
        <circle cx="292.4" cy="471.6" r="23.64" fill="url(#lp-b3)" />
        <circle cx="261.9" cy="171.8" r="35.9" fill="var(--plate-bg, #ffffff)" />
        <circle cx="261.9" cy="171.8" r="35.9" fill="url(#lp-a3)" />
        <circle cx="244" cy="369" r="23.94" fill="var(--plate-bg, #ffffff)" />
        <circle cx="244" cy="369" r="23.94" fill="url(#lp-b3)" />
        <circle cx="226.1" cy="566.4" r="35.93" fill="var(--plate-bg, #ffffff)" />
        <circle cx="226.1" cy="566.4" r="35.93" fill="url(#lp-a3)" />
        <circle cx="194.4" cy="263.7" r="24.25" fill="var(--plate-bg, #ffffff)" />
        <circle cx="194.4" cy="263.7" r="24.25" fill="url(#lp-b3)" />
        <circle cx="176.2" cy="463.6" r="24.26" fill="var(--plate-bg, #ffffff)" />
        <circle cx="176.2" cy="463.6" r="24.26" fill="url(#lp-b3)" />
        <circle cx="125.1" cy="358.2" r="36.86" fill="var(--plate-bg, #ffffff)" />
        <circle cx="125.1" cy="358.2" r="36.86" fill="url(#lp-a3)" />
        <circle cx="604.2" cy="546.7" r="39.29" fill="var(--plate-bg, #ffffff)" />
        <circle cx="604.2" cy="546.7" r="39.29" fill="url(#lp-a2)" />
        <circle cx="554.9" cy="433.9" r="26.56" fill="var(--plate-bg, #ffffff)" />
        <circle cx="554.9" cy="433.9" r="26.56" fill="url(#lp-b2)" />
        <circle cx="504.3" cy="317.9" r="40.41" fill="var(--plate-bg, #ffffff)" />
        <circle cx="504.3" cy="317.9" r="40.41" fill="url(#lp-a2)" />
        <circle cx="484.2" cy="540" r="26.95" fill="var(--plate-bg, #ffffff)" />
        <circle cx="484.2" cy="540" r="26.95" fill="url(#lp-b2)" />
        <circle cx="452.1" cy="198.5" r="27.33" fill="var(--plate-bg, #ffffff)" />
        <circle cx="452.1" cy="198.5" r="27.33" fill="url(#lp-b2)" />
        <circle cx="431.7" cy="423.8" r="27.34" fill="var(--plate-bg, #ffffff)" />
        <circle cx="431.7" cy="423.8" r="27.34" fill="url(#lp-b2)" />
        <circle cx="398.4" cy="75.6" r="41.6" fill="var(--plate-bg, #ffffff)" />
        <circle cx="398.4" cy="75.6" r="41.6" fill="url(#lp-a2)" />
        <circle cx="377.7" cy="304.1" r="27.75" fill="var(--plate-bg, #ffffff)" />
        <circle cx="377.7" cy="304.1" r="27.75" fill="url(#lp-b2)" />
        <circle cx="357" cy="532.9" r="41.64" fill="var(--plate-bg, #ffffff)" />
        <circle cx="357" cy="532.9" r="41.64" fill="url(#lp-a2)" />
        <circle cx="322.1" cy="180.9" r="28.16" fill="var(--plate-bg, #ffffff)" />
        <circle cx="322.1" cy="180.9" r="28.16" fill="url(#lp-b2)" />
        <circle cx="301" cy="413" r="28.18" fill="var(--plate-bg, #ffffff)" />
        <circle cx="301" cy="413" r="28.18" fill="url(#lp-b2)" />
        <circle cx="243.4" cy="289.6" r="42.9" fill="var(--plate-bg, #ffffff)" />
        <circle cx="243.4" cy="289.6" r="42.9" fill="url(#lp-a2)" />
        <circle cx="221.9" cy="525.4" r="28.62" fill="var(--plate-bg, #ffffff)" />
        <circle cx="221.9" cy="525.4" r="28.62" fill="url(#lp-b2)" />
        <circle cx="162.2" cy="401.6" r="29.06" fill="var(--plate-bg, #ffffff)" />
        <circle cx="162.2" cy="401.6" r="29.06" fill="url(#lp-b2)" />
        <circle cx="78.3" cy="517.4" r="44.29" fill="var(--plate-bg, #ffffff)" />
        <circle cx="78.3" cy="517.4" r="44.29" fill="url(#lp-a2)" />
        <circle cx="537.4" cy="486.8" r="49.52" fill="var(--plate-bg, #ffffff)" />
        <circle cx="537.4" cy="486.8" r="49.52" fill="url(#lp-a1)" />
        <circle cx="473.9" cy="343" r="33.6" fill="var(--plate-bg, #ffffff)" />
        <circle cx="473.9" cy="343" r="33.6" fill="url(#lp-b1)" />
        <circle cx="408.1" cy="194" r="51.32" fill="var(--plate-bg, #ffffff)" />
        <circle cx="408.1" cy="194" r="51.32" fill="url(#lp-a1)" />
        <circle cx="382.6" cy="476" r="34.23" fill="var(--plate-bg, #ffffff)" />
        <circle cx="382.6" cy="476" r="34.23" fill="url(#lp-b1)" />
        <circle cx="313.8" cy="326.7" r="34.87" fill="var(--plate-bg, #ffffff)" />
        <circle cx="313.8" cy="326.7" r="34.87" fill="url(#lp-b1)" />
        <circle cx="215.8" cy="464.5" r="53.32" fill="var(--plate-bg, #ffffff)" />
        <circle cx="215.8" cy="464.5" r="53.32" fill="url(#lp-a1)" />
        <circle cx="423.7" cy="384.7" r="66.95" fill="var(--plate-bg, #ffffff)" />
        <circle cx="423.7" cy="384.7" r="66.95" fill="url(#lp-a0)" />
      <g stroke="var(--plate-cell, #2a78d6)" strokeDasharray="10.5 8.1" strokeLinecap="round" fill="none">
        <g strokeWidth="3.55" strokeOpacity="0.95">
          <line x1="215.8" y1="464.5" x2="423.7" y2="384.7" />
          <line x1="423.7" y1="384.7" x2="408.1" y2="194" />
          <line x1="408.1" y1="194" x2="243.4" y2="289.6" />
          <line x1="243.4" y1="289.6" x2="215.8" y2="464.5" />
          <line x1="215.8" y1="464.5" x2="357" y2="532.9" />
          <line x1="423.7" y1="384.7" x2="537.4" y2="486.8" />
        </g>
      </g>
    </svg>
  );
}
