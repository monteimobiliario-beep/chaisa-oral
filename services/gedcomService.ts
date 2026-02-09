
import { ProcessedData, Individual } from "../types";

const formatGedcomName = (fullName: string): string => {
  const nameTrimmed = fullName.trim();
  if (!nameTrimmed) return "";
  const parts = nameTrimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 2) return nameTrimmed;
  const surname = parts.pop();
  return `${parts.join(' ')} /${surname}/`;
};

export const generateGEDCOM = (data: ProcessedData): string => {
  const date = new Date();
  const gedDate = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  
  let ged = [
    `0 HEAD`,
    `1 SOUR OralGen`,
    `1 DATE ${gedDate}`,
    `1 CHAR UTF-8`,
    `1 GEDC`,
    `2 VERS 5.5.1`,
    `2 FORM LINEAGE-LINKED`
  ];

  interface Family {
    husb?: number;
    wife?: number;
    children: Set<number>;
  }

  const families = new Map<string, Family>();
  const parentOf = new Map<number, Set<number>>();

  const getFamKey = (p1: number, p2?: number) => {
    if (!p2) return `FAM_SINGLE_${p1}`;
    const ids = [p1, p2].sort((a, b) => a - b);
    return `FAM_COUPLE_${ids[0]}_${ids[1]}`;
  };

  const getOrInitFamily = (key: string): Family => {
    if (!families.has(key)) families.set(key, { children: new Set() });
    return families.get(key)!;
  };

  // PASSO 1: Mapear Uniões e Relações
  data.individuals.forEach(ind => {
    const rel = (ind.relation || '').toUpperCase().trim();
    if (!rel) return;

    // Cônjuges (C<n>)
    if (rel.startsWith('C')) {
      const partnerRin = parseInt(rel.substring(1));
      if (!isNaN(partnerRin)) {
        const key = getFamKey(ind.rin, partnerRin);
        const fam = getOrInitFamily(key);
        const partner = data.individuals.find(i => i.rin === partnerRin);
        
        if (ind.sex === 'M' || (!ind.sex && ind.rin < partnerRin)) fam.husb = ind.rin;
        else fam.wife = ind.rin;

        if (partner?.sex === 'M' || (!partner?.sex && partnerRin < ind.rin)) fam.husb = partnerRin;
        else fam.wife = partnerRin;
      }
    }

    // Filhos de Casal (F<n>,<m> ou F<n>,F<m>)
    if (rel.startsWith('F')) {
      const cleanRel = rel.replace(/F/g, ''); // Remove todos os 'F' para pegar apenas números
      const parents = cleanRel.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      parents.forEach(p => {
        if (!parentOf.has(ind.rin)) parentOf.set(ind.rin, new Set());
        parentOf.get(ind.rin)!.add(p);
      });
    }

    // Progenitor de (P<k>)
    if (rel.startsWith('P')) {
      const childRin = parseInt(rel.substring(1));
      if (!isNaN(childRin)) {
        if (!parentOf.has(childRin)) parentOf.set(childRin, new Set());
        parentOf.get(childRin)!.add(ind.rin);
      }
    }
  });

  // PASSO 2: Resolver Filiações
  parentOf.forEach((parents, childRin) => {
    const parentList = Array.from(parents);
    let famKey = "";

    if (parentList.length >= 2) {
      famKey = getFamKey(parentList[0], parentList[1]);
    } else if (parentList.length === 1) {
      const p1 = parentList[0];
      const indP1 = data.individuals.find(i => i.rin === p1);
      const partnerRel = (indP1?.relation || "").toUpperCase().trim();
      
      if (partnerRel.startsWith('C')) {
        const p2 = parseInt(partnerRel.substring(1));
        famKey = getFamKey(p1, p2);
      } else {
        famKey = getFamKey(p1);
      }
    }

    if (famKey) {
      const fam = getOrInitFamily(famKey);
      if (parentList.length === 1 && !fam.husb && !fam.wife) {
        const pInd = data.individuals.find(i => i.rin === parentList[0]);
        if (pInd?.sex === 'F') fam.wife = parentList[0];
        else fam.husb = parentList[0];
      }
      fam.children.add(childRin);
    }
  });

  // PASSO 3: Exportar
  data.individuals.forEach(ind => {
    ged.push(`0 @I${ind.rin}@ INDI`);
    ged.push(`1 NAME ${formatGedcomName(ind.fullName)}`);
    if (ind.sex) ged.push(`1 SEX ${ind.sex}`);
    
    if (ind.birthDate || ind.birthPlace) {
      ged.push(`1 BIRT`);
      if (ind.birthDate) ged.push(`2 DATE ${ind.birthDate}`);
      if (ind.birthPlace) ged.push(`2 PLAC ${ind.birthPlace}`);
    }

    if (ind.deathDate || ind.deathPlace) {
      ged.push(`1 DEAT`);
      if (ind.deathDate) ged.push(`2 DATE ${ind.deathDate}`);
      if (ind.deathPlace) ged.push(`2 PLAC ${ind.deathPlace}`);
    }

    families.forEach((fam, famId) => {
      if (fam.husb === ind.rin || fam.wife === ind.rin) ged.push(`1 FAMS @${famId}@`);
      if (fam.children.has(ind.rin)) ged.push(`1 FAMC @${famId}@`);
    });
  });

  families.forEach((fam, famId) => {
    ged.push(`0 @${famId}@ FAM`);
    if (fam.husb) ged.push(`1 HUSB @I${fam.husb}@`);
    if (fam.wife) ged.push(`1 WIFE @I${fam.wife}@`);
    fam.children.forEach(c => ged.push(`1 CHIL @I${c}@`));
  });

  ged.push(`0 TRLR`);
  return ged.join('\n');
};
