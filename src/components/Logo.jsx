import React from "react";

/*
 * The Moose Knuckles mark, redrawn as vector so it stays sharp at any size and
 * takes its colour from the surrounding text.
 *
 * TO USE THE OFFICIAL ARTWORK INSTEAD: drop the file into `public/` and replace
 * the <svg> below with, for example:
 *     <img src="/logo.svg" alt="Moose Knuckles" className="logo-mark" />
 * Nothing else in the app needs to change.
 *
 * Each half runs from the apex down to a ring. The inner edge is the tangent
 * that lands exactly vertical, giving the straight central split; the outer
 * edge is a shallow R=110 arc into the ring's other tangent point, which is
 * what makes it read as a drop rather than a dart. Meeting the ring at its
 * tangent points is what stops the edges kinking. The ring arcs take the long
 * way round (large-arc 1) so they wrap its bottom, and fill-rule evenodd cuts
 * the holes out.
 */
const Mark = () => (
  <svg className="logo-mark" viewBox="3 0 94 100" role="img" aria-label="Moose Knuckles"
       fill="currentColor" fillRule="evenodd" focusable="false">
    <path d="M49,2 A110,110 0 0 0 10.13,64.97 A21,21 0 1 0 49,76 Z
             M28,64.5 A11.5,11.5 0 1 0 28,87.5 A11.5,11.5 0 1 0 28,64.5 Z" />
    <path d="M51,2 A110,110 0 0 1 89.87,64.97 A21,21 0 1 1 51,76 Z
             M72,64.5 A11.5,11.5 0 1 1 72,87.5 A11.5,11.5 0 1 1 72,64.5 Z" />
  </svg>
);

export default function Logo() {
  return (
    <div className="logo">
      <Mark />
      <span className="logo-word">Moose Knuckles</span>
    </div>
  );
}
