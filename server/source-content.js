const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const knowledge = require("../content/knowledge.json");
const root = path.resolve(__dirname, "..");

function installSourceContent(db, permissions) {
  const knowledgeRow = db
    .prepare("SELECT 1 FROM settings WHERE key=?")
    .get("knowledge");
  if (!knowledgeRow) {
    db.prepare("INSERT INTO settings(key,data) VALUES(?,?)").run(
      "knowledge",
      JSON.stringify(knowledge),
    );
  }
  const marker = "source-content-teal-v1";
  if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get(marker)) {
    db.transaction(() => {
      const siteRow = db
        .prepare("SELECT data FROM settings WHERE key='site'")
        .get();
      const site = JSON.parse(siteRow.data);
      const replacements = {
        heroTitle: ["让每一次头皮护理，", "科学养护，"],
        heroAccent: ["都有科学依据。", "让美好从头开始。"],
        heroDescription: [
          "从头皮检测到长期养护，博士园以“养 · 防 · 植 · 健”为一体的毛发健康管理，为每一种发质找到更适合的答案。",
          "30 余年毛发研究积累，连接专业门店护理与日常居家养护。博士园，以养、防、植、健一体的毛发健康服务，陪伴每一份对美好生活的期待。",
        ],
        brandIntro: [
          "2000 年，北京博士园毛发研究中心成立。二十余年来，我们持续围绕脱发、白发与头皮亚健康开展研究，将产品研发、门店护理、居家养护与植发相关服务连接起来。",
          knowledge.brand.description,
        ],
      };
      for (const [key, [oldValue, newValue]] of Object.entries(replacements)) {
        if (site[key] === oldValue) site[key] = newValue;
      }
      db.prepare("UPDATE settings SET data=? WHERE key='site'").run(
        JSON.stringify(site),
      );
      const defaults = {
        头皮调理: ["assets/care.jpg", "assets/brand-care-1.webp"],
        脱发养护: ["assets/care-2.jpg", "assets/brand-care-2.webp"],
        白发养护: ["assets/care-3.jpg", "assets/brand-care-3.webp"],
        发干滋养: ["assets/care-4.jpg", "assets/brand-care-4.webp"],
        植发健发: ["assets/care.jpg", "assets/brand-laboratory.webp"],
        居家养护: ["assets/care-5.jpg", "assets/brand-products.webp"],
      };
      for (const row of db
        .prepare("SELECT * FROM items WHERE type='services'")
        .all()) {
        const data = JSON.parse(row.data),
          entry = defaults[data.name];
        if (entry && data.image === entry[0]) {
          data.image = entry[1];
          db.prepare("UPDATE items SET data=? WHERE id=?").run(
            JSON.stringify(data),
            row.id,
          );
        }
      }
      const stamp = new Date().toISOString();
      if (
        !db.prepare("SELECT 1 FROM items WHERE type='products' LIMIT 1").get()
      ) {
        const insert = db.prepare("INSERT INTO items VALUES (?,?,?,?,?,?)");
        for (const product of knowledge.products)
          insert.run(
            randomUUID(),
            "products",
            JSON.stringify(product),
            1,
            stamp,
            stamp,
          );
      }
      for (const role of db.prepare("SELECT * FROM roles").all()) {
        if (role.protected) {
          db.prepare("UPDATE roles SET permissions=? WHERE id=?").run(
            JSON.stringify(Object.keys(permissions)),
            role.id,
          );
        } else if (["operations", "editor", "viewer"].includes(role.id)) {
          const grants = new Set(JSON.parse(role.permissions));
          if (grants.has("services.read")) grants.add("products.read");
          if (grants.has("services.write")) grants.add("products.write");
          db.prepare("UPDATE roles SET permissions=? WHERE id=?").run(
            JSON.stringify([...grants]),
            role.id,
          );
        }
      }
      const insertMedia = db.prepare(
        "INSERT OR IGNORE INTO media VALUES(?,?,?,?,?)",
      );
      for (const file of fs.readdirSync(path.join(root, "assets"))) {
        if (!/^(brand-|bosye-).+\.(png|jpe?g|webp)$/i.test(file)) continue;
        const size = fs.statSync(path.join(root, "assets", file)).size;
        if (
          size < 20000 &&
          file !== "bosye-logo.png" &&
          file !== "bosye-ewm.jpg"
        )
          continue;
        insertMedia.run(
          randomUUID(),
          file
            .replace(/^brand-/, "品牌素材 · ")
            .replace(/^bosye-/, "官网原图 · "),
          "assets/" + file,
          size,
          stamp,
        );
      }
      db.prepare("INSERT INTO settings VALUES(?,?)").run(
        marker,
        JSON.stringify({
          installedAt: stamp,
          sourceVersion: knowledge.version,
        }),
      );
    })();
  }

  // Install the 2026-10-16 website image set once. The marker keeps later
  // administrator-selected images intact while allowing existing databases
  // to receive the newly supplied service, product and training images.
  const imageMarker = "content-images-2026-10-16-v1";
  if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get(imageMarker)) {
    db.transaction(() => {
      const serviceImages = {
        头皮调理: "assets/brand-service-scalp-care.webp",
        脱发养护: "assets/brand-service-hair-loss.webp",
        白发养护: "assets/brand-service-grey-hair.webp",
        发干滋养: "assets/brand-service-scientific-care.webp",
        植发健发: "assets/brand-service-transplant-care.webp",
        居家养护: "assets/brand-service-home-care.webp",
      };
      const productImages = {
        脱发养护系列: "assets/brand-product-hair-loss.webp",
        白发养护系列: "assets/brand-product-grey-hair.webp",
        植发健发系列: "assets/brand-product-transplant-care.webp",
        头皮调理系列: "assets/brand-product-scalp-care.webp",
        发干滋养系列: "assets/brand-product-hair-nourishment.webp",
        居家养护系列: "assets/brand-product-home-care.webp",
      };
      const updateImages = (type, images) => {
        for (const row of db
          .prepare("SELECT * FROM items WHERE type=?")
          .all(type)) {
          const data = JSON.parse(row.data);
          const image = images[data.name];
          if (!image) continue;
          data.image = image;
          db.prepare("UPDATE items SET data=?,updated_at=? WHERE id=?").run(
            JSON.stringify(data),
            new Date().toISOString(),
            row.id,
          );
        }
      };
      updateImages("services", serviceImages);
      updateImages("products", productImages);
      const insertMedia = db.prepare(
        "INSERT OR IGNORE INTO media VALUES(?,?,?,?,?)",
      );
      const stamp = new Date().toISOString();
      for (const file of fs.readdirSync(path.join(root, "assets"))) {
        if (
          !/^brand-(?:service|product)-.+\.webp$/i.test(file) &&
          file !== "brand-training-classroom.webp"
        )
          continue;
        const size = fs.statSync(path.join(root, "assets", file)).size;
        insertMedia.run(
          randomUUID(),
          "新官网素材 · " + file.replace(/^brand-/, ""),
          "assets/" + file,
          size,
          stamp,
        );
      }
      db.prepare("INSERT INTO settings VALUES(?,?)").run(
        imageMarker,
        JSON.stringify({ installedAt: stamp }),
      );
    })();
  }

  const copyMarker = "content-doc-2026-10-13-v1";
  if (db.prepare("SELECT 1 FROM settings WHERE key=?").get(copyMarker)) return;
  db.transaction(() => {
    const stamp = new Date().toISOString();
    const siteRow = db
      .prepare("SELECT data FROM settings WHERE key='site'")
      .get();
    const site = JSON.parse(siteRow.data);
    Object.assign(site, {
      heroTitle: "科学养护",
      heroAccent: "全周期毛发健康管理",
      heroDescription:
        "30 余年毛发研究积累，连接专业门店护理与日常居家养护。博士园，以养、防、植、健一体的毛发健康服务，陪伴每一份对美好生活的期待。",
      brandIntro: knowledge.brand.description,
      seoTitle: "博士园｜科学毛发健康管理",
      seoDescription:
        "博士园——专注脱发白发的科研型毛发健康管理连锁品牌，提供头皮调理、脱发养护、白发养护、头油头屑等护理服务及植发植眉等毛发移植服务。",
    });
    db.prepare("UPDATE settings SET data=? WHERE key='site'").run(
      JSON.stringify(site),
    );

    const services = {
      头皮调理: {
        english: "SCALP CARE",
        summary: "清洁 · 舒缓 · 水油平衡",
        body: "围绕头皮清洁、补水与油脂平衡，结合实际头皮状态提供护理服务。门店检测、沟通需求、制定养护安排，并持续评估体验。",
      },
      脱发养护: {
        english: "HAIR CARE",
        summary: "强韧 · 滋养 · 防治结合",
        body: "针对多种脱发情况，从日常洗护习惯与头皮状态出发，搭配康发露、丝韧营养露、头皮强韧精华液等产品。护理方案由门店沟通确认；持续或突发脱发建议及时就医。进行合理预防与分阶段防脱养护。",
      },
      白发养护: {
        english: "GREY HAIR CARE",
        summary: "防白 · 修护 · 长期管理",
        body: "以黑秀精华露等养护系列配合日常护理，针对性补充营养，呵护色素组织，调理毛发生长微环境，改善白发状况，关注头皮与发丝状态，分阶段沟通养护预期。产品使用以说明书及实际适用情况为准。",
      },
      发干滋养: {
        english: "HAIR NOURISHMENT",
        summary: "柔顺 · 保湿 · 发丝修护",
        body: "围绕发丝干燥、毛躁等日常需求，修护受损毛发、改善头发干枯毛糙、发黄分叉、细软易断等毛发问题。提供发膜及护发精油护理，帮助建立适合自己的洗护习惯。",
      },
      植发健发: {
        english: "POST-TRANSPLANT CARE",
        summary: "专业协同 · 养护跟进",
        body: "提供植发相关日常养护咨询，医疗植发业务由具备资质的医疗机构承接。生活美容门店不开展医疗诊疗或手术。改善毛囊生长环境，持续提供营养，帮助休眠毛囊焕发生机。通过植发与术后健发，及时及早修补局部毛发分布缺陷，维护形象，持久、自然美观。",
      },
      居家养护: {
        english: "HOME ROUTINE",
        summary: "洗护 · 精华 · 每日养护",
        body: "将门店护理延续到家，按头皮与发质需求搭配洗发露、护发产品和精华。避免过度清洁，按产品说明使用。与在店毛发保健相得益彰，维护秀发健康强韧，强化养发效果。",
      },
    };
    for (const row of db
      .prepare("SELECT * FROM items WHERE type='services'")
      .all()) {
      const data = JSON.parse(row.data),
        update = services[data.name];
      if (!update) continue;
      Object.assign(data, update);
      db.prepare("UPDATE items SET data=?,updated_at=? WHERE id=?").run(
        JSON.stringify(data),
        stamp,
        row.id,
      );
    }

    const productRows = db
      .prepare("SELECT * FROM items WHERE type='products'")
      .all();
    const byName = new Map(knowledge.products.map((v) => [v.name, v]));
    for (const row of productRows) {
      const data = JSON.parse(row.data),
        source = byName.get(data.name);
      if (!source) continue;
      db.prepare("UPDATE items SET data=?,updated_at=? WHERE id=?").run(
        JSON.stringify({ ...data, ...source }),
        stamp,
        row.id,
      );
    }
    db.prepare("INSERT INTO settings VALUES(?,?)").run(
      copyMarker,
      JSON.stringify({ installedAt: stamp, sourceVersion: knowledge.version }),
    );
  })();
}
module.exports = { installSourceContent };
