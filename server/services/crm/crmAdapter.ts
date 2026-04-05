/**
 * CRM Abstract Adapter — Interface for CRM operations
 * Concrete implementations: gohighlevel.ts
 */

export interface CRMContact {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface CRMOpportunity {
  id?: string;
  contactId: string;
  name: string;
  stageId: string;
  monetaryValue?: number;
}

export interface CRMAdapter {
  name: string;
  createContact(contact: CRMContact): Promise<string | null>;
  updateContact(id: string, data: Partial<CRMContact>): Promise<boolean>;
  deleteContact(id: string): Promise<boolean>;
  createOpportunity(opp: CRMOpportunity): Promise<string | null>;
  applyTags(contactId: string, tags: string[]): Promise<boolean>;
}

export function getCRMAdapter(): CRMAdapter | null {
  // Currently only GoHighLevel supported
  if (process.env.GHL_API_TOKEN) {
    return {
      name: "gohighlevel",
      async createContact(contact) {
        const { createContact } = await import("./gohighlevel");
        const result = await createContact(contact);
        return result?.contact?.id || null;
      },
      async updateContact(id, data) {
        const { updateContact } = await import("./gohighlevel");
        const result = await updateContact(id, data);
        return result != null;
      },
      async deleteContact(id) {
        const { deleteContact } = await import("./gohighlevel");
        const result = await deleteContact(id);
        return result != null;
      },
      async createOpportunity(opp) {
        const { createOpportunity } = await import("./gohighlevel");
        const result = await createOpportunity(opp);
        return result?.opportunity?.id || null;
      },
      async applyTags(contactId, tags) {
        const { updateContact } = await import("./gohighlevel");
        const result = await updateContact(contactId, { tags });
        return result != null;
      },
    };
  }

  return null;
}
