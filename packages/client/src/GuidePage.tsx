import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { marked } from "marked";
import { createMemo, createResource, Show } from "solid-js";

import { activityArt, baseName, tileArt } from "./activities.ts";
import { activityTables } from "./activityTables.ts";
import { guideNamed } from "./guides.ts";
import { Button } from "./ui/Button.tsx";
import { activityLabel, tabHref } from "./url.ts";

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
  body.className = "card-body guide-body";
  body.append(template.content);

  const card = document.createElement("div");
  card.className = "card";
  card.append(body);

  return card;
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
    <div class="flex flex-col gap-3 px-3 pt-3 pb-6">
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
        fallback={<p class="text-muted">No guide for this activity.</p>}
      >
        {(found) => (
          <div class="flex flex-col gap-3">
            <div class="card overflow-hidden">
              <div
                class="hero-art flex min-h-[200px] flex-col items-center justify-center gap-1 p-6 text-center"
                style={{ "--art": tileArt(art(), typeName()) }}
              >
                <h2 class="m-0 text-2xl leading-tight">{found().name}</h2>
                <span class="text-md text-text">{typeName()}</span>
              </div>
            </div>
            {render(found().body)}
          </div>
        )}
      </Show>
    </div>
  );
};
