import { queryDistinguishedMembers } from "../../Db.js";
import { CoopParams } from "../../Site.js";

const TAG_GROUPS = [
  {
    key: "farmers friend",
    heading: "Farmers' friends",
  },
  {
    key: "sustaining steward",
    heading: "Sustaining stewards",
  },
  {
    key: "community cultivator",
    heading: "Community cultivators",
  },
];

const ANONYMOUS_TAG = "keep anonymous";

const normalizeTag = tag => tag.trim().toLowerCase();

function deriveMemberName(member) {
  const primaryName = [member.Name1First, member.Name1Last].filter(Boolean).join(" ").trim();
  const secondaryName = [member.Name2First, member.Name2Last].filter(Boolean).join(" ").trim();
  const businessName = member.NameBus ? member.NameBus.trim() : "";

  if (primaryName && secondaryName) return `${primaryName} & ${secondaryName}`;
  if (primaryName) return primaryName;
  if (secondaryName) return secondaryName;
  if (businessName) return businessName;
  return `Member ${member.IDMemb}`;
}

function selectGroup(tagsLower) {
  for (const group of TAG_GROUPS) {
    const candidates = new Set([group.key].map(tag => tag.toLowerCase()));
    for (const tag of tagsLower) {
      if (candidates.has(tag)) return group;
    }
  }
  return null;
}

export async function wHandGet(aReq, aResp) {
  const distinguishedMembers = await queryDistinguishedMembers();

  const sections = TAG_GROUPS.map(group => ({ ...group, members: [] }));
  const sectionsByKey = sections.reduce((acc, section) => {
    acc[section.key] = section;
    return acc;
  }, {});

  for (const member of distinguishedMembers) {
    const tagsLower = member.Tags
      ? Array.from(
          new Set(
            member.Tags.split("||")
              .map(tag => tag && tag.trim())
              .filter(Boolean)
              .map(normalizeTag),
          ),
        )
      : [];

    const group = selectGroup(tagsLower);
    if (!group) continue;

    const section = sectionsByKey[group.key];
    if (!section) continue;

    const isAnonymous = tagsLower.includes(ANONYMOUS_TAG);
    const displayName = isAnonymous ? "Anonymous member" : deriveMemberName(member);

    section.members.push({
      id: member.IDMemb,
      displayName,
      isAnonymous,
    });
  }

  sections.forEach(section => {
    section.members.sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  const populatedSections = sections.filter(section => section.members.length > 0);

  aResp.locals.Title = `${CoopParams.CoopNameShort} distinguished members`;
  aResp.locals.Sections = populatedSections;
  aResp.render("Home/distinguished-members");
}
