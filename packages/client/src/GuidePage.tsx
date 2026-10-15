import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { marked } from "marked";
import { createMemo, createResource, Show } from "solid-js";

import { activityArt, baseName, tileArt } from "./activities.ts";
import { activityTables } from "./activityTables.ts";
import { guideNamed } from "./guides.ts";
import { HERO } from "./ui/text.ts";
import { Button } from "./ui/zaidan/button.tsx";
import { activityLabel, tabHref } from "./url.ts";

const PROSE =
  "flex flex-col gap-4 rounded-xl bg-card p-6 leading-relaxed text-foreground/85 ring-1 ring-foreground/10 [&>:first-child]:mt-0 [&_:is(h1,h2,h3)]:mt-4 [&_:is(h1,h2,h3)]:leading-tight [&_:is(h1,h2,h3)]:font-semibold [&_:is(h1,h2,h3)]:text-foreground [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-base [&_:is(ul,ol)]:flex [&_:is(ul,ol)]:flex-col [&_:is(ul,ol)]:gap-1.5 [&_:is(ul,ol)]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_img]:rounded-md [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-input [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";

// A template stays inert, so images pick up the referrer policy before they load
const render = (markdown: string): HTMLDivElement => {
  const template = document.createElement("template");
  template.innerHTML = marked.parse(markdown, { async: false });

  for (const link of template.content.querySelectorAll("a")) {
    link.target = "_blank";
    link.rel = "noreferrer";
  }

  // Some hosts refuse hotlinks that carry a referrer
  for (const image of template.content.querySelectorAll("img")) {
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
  }

  const body = document.createElement("div");
  body.className = PROSE;
  body.append(template.content);

  return body;
};

interface GuideState {
  inApp: boolean;
}

export const GuidePage = () => {
  const params = useParams();
  const location = useLocation<GuideState>();
  const navigate = useNavigate();
  const [tables] = createResource(activityTables, {
    initialValue: activityTables.settled(),
  });

  const guide = () => guideNamed(activityLabel(params.label) ?? "");

  const definition = createMemo(() => {
    const found = tables();
    const name = guide()?.name;

    if (!found || name === undefined) {
      return undefined;
    }

    return Object.values(found.activities).find(
      (one) => baseName(one) === name,
    );
  });

  const typeName = () => {
    const hash = definition()?.activityTypeHash;

    return hash === undefined ? undefined : tables()?.types[hash]?.name;
  };

  const art = () => {
    const found = tables();
    const one = definition();

    return found && one ? activityArt(one, found) : undefined;
  };

  return (
    <div class="flex max-w-5xl flex-col gap-3 p-4 pb-8">
      <Button
        size="sm"
        variant="ghost"
        class="self-start"
        onClick={() => {
          // Opened from a pasted URL there's nothing in the app to go back to
          if (location.state?.inApp) {
            navigate(-1);
          } else {
            navigate(tabHref("activities"));
          }
        }}
      >
        &larr; Back
      </Button>
      <Show
        when={guide()}
        fallback={
          <p class="text-muted-foreground">No guide for this activity.</p>
        }
      >
        {(found) => (
          <div class="flex flex-col gap-3">
            <div
              class={`${HERO} rounded-lg`}
              style={{ "--art": tileArt(art(), typeName()) }}
            >
              <h2 class="text-2xl leading-tight font-semibold">
                {found().name}
              </h2>
              <span class="text-foreground/80">{typeName()}</span>
            </div>
            {render(found().body)}
          </div>
        )}
      </Show>
    </div>
  );
};
