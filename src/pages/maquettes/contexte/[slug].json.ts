import prospects from '../../../data/prospects.json';
import {publicProspectContext} from '../../../lib/prospect-context.mjs';

export function getStaticPaths() {
  return prospects.map(prospect => ({params: {slug: prospect.slug}, props: {prospect}}));
}

export function GET({props}) {
  return new Response(JSON.stringify(publicProspectContext(props.prospect)), {
    headers: {'Content-Type': 'application/json; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow'},
  });
}
