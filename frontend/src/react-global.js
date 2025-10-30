// Ensure a global React object exists *before* other modules run.
import * as React from "react";
if (typeof window !== "undefined") {
  window.React = React;
}
