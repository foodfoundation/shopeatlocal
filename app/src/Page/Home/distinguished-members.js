import { queryDistinguishedMembers } from "../../Db.js";
import { CoopParams, Site } from "../../Site.js";

const ANONYMOUS_TAG = "keep anonymous";

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

export async function wHandGet(aReq, aResp) {
  if (!Site.CkShowDistinguishedMembersPage) {
    aResp.locals.Title = "Page not found";
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const distinguishedMembers = await queryDistinguishedMembers(ANONYMOUS_TAG);
  const sectionsByTagId = new Map();

  for (const member of distinguishedMembers) {
    let section = sectionsByTagId.get(member.IDMemberTag);
    if (!section) {
      section = {
        heading: member.DisplayName,
        members: [],
      };
      sectionsByTagId.set(member.IDMemberTag, section);
    }

    const isAnonymous = Boolean(member.IsAnonymous);
    const displayName = isAnonymous ? "Anonymous member" : deriveMemberName(member);

    section.members.push({
      id: member.IDMemb,
      displayName,
      isAnonymous,
    });
  }

  const sections = Array.from(sectionsByTagId.values());
  sections.forEach(section => {
    section.members.sort((a, b) => {
      if (a.isAnonymous && !b.isAnonymous) return 1;
      if (!a.isAnonymous && b.isAnonymous) return -1;
      return a.displayName.localeCompare(b.displayName);
    });
  });

  aResp.locals.Title = `${CoopParams.CoopNameShort} distinguished members`;
  aResp.locals.Sections = sections;
  aResp.render("Home/distinguished-members");
}
