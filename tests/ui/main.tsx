import React from "react";
import { createRoot } from "react-dom/client";
import { Tracker } from "../../src/components/tracker";
import "../../src/app/globals.css";
import { initialData } from "./actions";
createRoot(document.getElementById("root")!).render(<Tracker initial={initialData()} today="2026-10-02" userName="Ari" />);
