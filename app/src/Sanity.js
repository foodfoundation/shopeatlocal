import imageUrlBuilder from "@sanity/image-url";
import { toHTML } from "@portabletext/to-html";
import { createClient } from "@sanity/client";

import { Sanity } from "../Cfg.js";

let sanityClientInstance = null;
const getSanityClient = () => {
  if (!sanityClientInstance) {
    sanityClientInstance = createClient(Sanity);
  }
  return {
    queryCoopParamsFromSanity: queryCoopParamsFromSanity(sanityClientInstance),
    queryInformationTemplates: queryInformationTemplates(sanityClientInstance),
    queryEmailTemplates: queryEmailTemplates(sanityClientInstance),
    queryTermsAndConditionsPageContent: queryTermsAndConditionsPageContent(sanityClientInstance),
    queryProductTypesPageMetadata: queryProductTypesPageMetadata(sanityClientInstance),
    queryProductTypesPageContent: queryProductTypesPageContent(sanityClientInstance),
    queryStaticPagesMetadata: queryStaticPagesMetadata(sanityClientInstance),
    queryStaticPageContent: queryStaticPageContent(sanityClientInstance),
  };
};

const queryCoopParamsFromSanity = client => async () => {
  const imageBuilder = imageUrlBuilder(client);
  const urlFor = imageSource => imageBuilder.image(imageSource).url();
  const sanityImageToUrl = transformSanityImageToUrl(urlFor);

  const coopData = await client.fetch('*[_type == "coopDetails"][0]');

  sanityImageToUrl(coopData);
  return coopData;
};

const queryInformationTemplates = client => async () => {
  const informationTemplates = await client.fetch('*[_type == "informationTemplates"][0]');

  const memberRegistrationHtml = generateContentHtml(informationTemplates.memberRegistrationText);
  const shoppingCartInformationText = informationTemplates.shoppingCartInformationText;

  return {
    memberRegistrationText: memberRegistrationHtml,
    shoppingCartInformationText,
  };
};

const queryEmailTemplates = client => async () => {
  const toEmailContent = emailContent =>
    toHTML(emailContent, {
      components: {
        marks: {
          textColor: ({ children, value }) =>
            `<span style="color: ${value.value}">${children}</span>`,
          highlightColor: ({ children, value }) =>
            `<span style="background-color: ${value.value}">${children}</span>`,
          emailAddressContent: ({ value, children }) =>
            `<a href="mailto:${value.emailAdd}">${children}</a>`,
        },
      },
    });

  const emailTemplates = await client.fetch('*[_type == "emailTemplates"][0]');

  const footerHtml = toEmailContent(emailTemplates.emailFooter);
  const appendEmailFooter = appendFooterFieldName => {
    const shouldAppend = emailTemplates[appendFooterFieldName];
    if (!shouldAppend) {
      return emailHtmlContent => emailHtmlContent;
    }
    return emailHtmlContent => {
      return `
			${emailHtmlContent}
			<br>
			${footerHtml}
		`;
    };
  };

  const generateEmailHtml = ({ subjectFieldName, contentFieldName, appendFooterFieldName }) => {
    const emailSubject = emailTemplates[subjectFieldName];
    const emailContent = toEmailContent(emailTemplates[contentFieldName]);
    return {
      [subjectFieldName]: emailSubject,
      [contentFieldName]: appendEmailFooter(appendFooterFieldName)(emailContent),
    };
  };

  const registrationEmail = generateEmailHtml({
    subjectFieldName: "registrationEmailSubject",
    contentFieldName: "registrationEmailContent",
    appendFooterFieldName: "registrationEmailAppendFooter",
  });

  return {
    ...registrationEmail,
  };
};

const queryTermsAndConditionsPageContent = client => async () => {
  const termsAndConditionsPage = await client.fetch('*[_type == "termsAndConditionsPage"][0]');

  const title = termsAndConditionsPage.title;
  const externalUrl = termsAndConditionsPage.externalUrl;
  if (externalUrl) {
    return {
      title,
      externalUrl,
    };
  }
  const content = generateContentHtml(termsAndConditionsPage.content);
  return {
    title,
    content,
  };
};

const queryProductTypesPageMetadata = client => async () => {
  const productTypesPage = await client.fetch('*[_type == "productTypesPage"][0]');

  const title = productTypesPage.title;
  const externalUrl = productTypesPage.externalUrl;
  const content = productTypesPage.content;
  const isDefined = !!(externalUrl || content);
  return {
    title,
    isDefined,
    externalUrl,
  };
};

const queryProductTypesPageContent = client => async () => {
  const productTypesPage = await client.fetch('*[_type == "productTypesPage"][0]');

  if (!productTypesPage) {
    return {
      isDefined: false,
      title: "",
      externalUrl: "",
      content: "",
    };
  }

  const title = productTypesPage.title;
  const externalUrl = productTypesPage.externalUrl;
  const content = productTypesPage.content;
  const isDefined = !!(externalUrl || content);
  return {
    title,
    isDefined,
    externalUrl,
    content: content ? generateContentHtml(content) : undefined,
  };
};

const queryStaticPagesMetadata = client => async () => {
  const staticPagesRes = await client.fetch('*[_type == "staticPages"]');

  const staticPages = staticPagesRes.map(staticPage => {
    const title = staticPage.title;
    const slug = staticPage.slug;
    const linkTitle = staticPage.linkTitle;
    const externalUrl = staticPage.externalUrl;
    const content = staticPage.content;
    const isDefined = !!(externalUrl || content);
    return {
      title,
      slug: slug.current,
      linkTitle,
      isDefined,
      externalUrl,
    };
  });

  return staticPages.filter(staticPage => staticPage.isDefined);
};

const queryStaticPageContent = client => async slug => {
  const staticPage = await client.fetch('*[_type == "staticPages" && slug.current == $slug][0]', {
    slug,
  });

  if (!staticPage) {
    return null;
  }

  const title = staticPage.title;
  const linkTitle = staticPage.linkTitle;
  const externalUrl = staticPage.externalUrl;
  const content = staticPage.content;
  const isDefined = !!(externalUrl || content);

  return {
    title,
    slug,
    isDefined,
    linkTitle,
    externalUrl,
    content: content ? generateContentHtml(content) : undefined,
  };
};

const generateContentHtml = content =>
  toHTML(content, {
    components: {
      block: ({ children, value }) => {
        switch (value.style) {
          case "h1":
            return `<h1 class="display-4">${children}</h1>`;
          case "h2":
            return `<h2 class="display-4 font-size-200">${children}</h2>`;
          case "normal":
            return `<p class="lead">${children}</p>`;
          case "small":
            return `<aside>${children}</aside>`;
          default:
            return `<p>${children}</p>`; // Default is a paragraph
        }
      },
      marks: {
        emailAddressContent: ({ value, children }) => {
          return `<a href="mailto:${value.emailAdd}">${children}</a>`;
        },
      },
      types: {
        break: ({ value, children }) => {
          switch (value.style) {
            case "break":
              return `<br>`;
            case "divider":
              return `<hr>`;
            default:
              return children;
          }
        },
        image: ({ value }) => {
          const { asset, alt } = value;
          const imageBuilder = imageUrlBuilder(sanityClientInstance);
          const imageUrl = imageBuilder.image(asset).url();
          return `<img src="${imageUrl}" alt="${alt}" class="img-fluid">`;
        },
        table: data => {
          return generateHtmlTable(data);
        },
      },
    },
  });

const transformSanityImageToUrl = urlFor => sanitySchemas => {
  Object.entries(sanitySchemas).forEach(([key, value]) => {
    if (isSanityAsset(value)) {
      sanitySchemas[key] = urlFor(value);
    }
  });
};

const isSanityAsset = field => {
  return field && field.asset;
};

const generateHtmlTable = data => {
  const rows = data?.value?.table?.rows;
  if (!rows || rows.length === 0) {
    return "";
  }

  // Extract the first row for <thead>
  const headerRow = rows[0];
  // Extract the rest of the rows for <tbody>
  const bodyRows = rows.slice(1);

  return `
      <table class="table table-sm table-striped table-hover table-bordered">
        <thead>
          <tr>
            ${headerRow.cells.map(cell => `<th style="text-align: right">${cell}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${bodyRows
            .map(row => {
              return `
                <tr>
                  ${row.cells
                    .map((cell, cellIndex) => {
                      // Apply <strong> for the first column
                      return cellIndex === 0
                        ? `<td><strong>${cell}</strong></td>`
                        : `<td style="padding-right: 0.5em; text-align: right;">${cell}</td>`;
                    })
                    .join("")}
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
};

const _getSanityClient = getSanityClient;
export { _getSanityClient as getSanityClient };
