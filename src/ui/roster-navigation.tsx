import { type ComponentProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { teamPlayerReturnPath } from "../presentation/team-player-list";

/** Ephemeral list context only; never enters a shared URL or personal storage. */
export function RosterContextLink(props: ComponentProps<typeof Link>) {
  const location = useLocation();
  const state = teamPlayerReturnPath(location.state) ? location.state : undefined;
  return <Link {...props} state={props.state === undefined ? state : props.state} />;
}

