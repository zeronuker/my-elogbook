// Double-line chamfered window frame shared by every modal. Styles: .cf-* in index.css.
// `color` overrides the line (default follows the accent); `face` overrides the fill behind the content;
// `pad` pads the content inside the lines.
export default function ChamferFrame({ color, face, pad, className = "", style, children, ...rest }) {
  const vars = { ...(color && { "--cf-line": color }), ...(face && { "--cf-face": face }), ...(pad && { "--cf-pad": pad }), ...style };
  return (
    <div className={"cf " + className} style={vars} {...rest}>
      <div className="cf-shadow" aria-hidden="true"><i /></div>
      <div className="cf-l1"><div className="cf-l2"><div className="cf-l3"><div className="cf-l4">
        {children}
      </div></div></div></div>
    </div>
  );
}
