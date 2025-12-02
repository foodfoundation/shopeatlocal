import { queryDistinguishedMembers } from "../../Db.js";
import { CoopParams } from "../../Site.js";

const TAG_GROUPS = [
  {
    key: "farmers friend",
    headingKey: "common:distinguishedMembers.farmersFriends",
  },
  {
    key: "sustaining steward",
    headingKey: "common:distinguishedMembers.sustainingStewards",
  },
  {
    key: "community cultivator",
    headingKey: "common:distinguishedMembers.communityCultivators",
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
  return null; // Will be replaced with translated "Member X" later
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

  const sections = TAG_GROUPS.map(group => ({ 
    ...group, 
    heading: aReq.t(group.headingKey),
    members: [] 
  }));
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
    const derivedName = deriveMemberName(member);
    const displayName = isAnonymous 
      ? aReq.t("common:distinguishedMembers.anonymousMember")
      : (derivedName || aReq.t("common:distinguishedMembers.memberWithId", { id: member.IDMemb }));

    section.members.push({
      id: member.IDMemb,
      displayName,
      isAnonymous,
    });
  }

  sections.forEach(section => {
    section.members.sort((a, b) => {
      if (a.isAnonymous && !b.isAnonymous) return 1;
      if (!a.isAnonymous && b.isAnonymous) return -1;
      return a.displayName.localeCompare(b.displayName);
    });
  });

  const populatedSections = sections.filter(section => section.members.length > 0);

  aResp.locals.Title = aReq.t("common:pageTitles.distinguishedMembers", { name: CoopParams.CoopNameShort });
  aResp.locals.Sections = populatedSections;
  aResp.render("Home/distinguished-members");
}
