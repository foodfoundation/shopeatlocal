// edit-member-tags.js
// ---------------------
// Edit member tags controllers

import { queryMemberTags, queryMemberTagAssignments, wUpd_MembTags } from "../../Db.js";
import { PageAfterEditMemb } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDMembEff = aResp.locals.CredSelImperUser.IDMemb;

  const allTags = await queryMemberTags();
  const assigned = await queryMemberTagAssignments(oIDMembEff);
  const assignedSet = new Set(assigned.map(a => a.IDMemberTag));

  const tags = allTags.map(t => ({ ...t, Ck: assignedSet.has(t.IDMemberTag) }));
  aResp.locals.Tags = tags;

  aResp.locals.Title = aReq.t("common:pageTitles.editMemberTags", { name: CoopParams.CoopNameShort });
  aResp.render("Memb/edit-member-tags");
}

export async function wHandPost(aReq, aResp) {
  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;

  // Parse selected tag IDs from form fields named Tag<IDMemberTag>
  const ids = [];
  for (const name in aReq.body) {
    const m = name.match(/^Tag(\d+)$/);
    if (m && m[1]) ids.push(parseInt(m[1]));
  }
  const uniqueIds = Array.from(new Set(ids));

  await wUpd_MembTags(oIDMemb, uniqueIds);

  aResp.Show_Flash("success", null, aReq.t("common:memberTags.tagsUpdated"));

  const oPage = PageAfterEditMemb(aReq, aResp);
  aResp.redirect(303, oPage);
}
