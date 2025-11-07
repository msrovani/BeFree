import { randomUUID } from 'crypto';

export type ProposalStatus = 'draft' | 'active' | 'closed' | 'cancelled';

export interface ProposalOptionInput {
  id?: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProposalOption {
  id: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProposalDraft {
  id?: string;
  title: string;
  description?: string;
  options: ProposalOptionInput[];
  metadata?: Record<string, unknown>;
  status?: ProposalStatus;
  quorum?: string | number | bigint;
  deadline?: number;
  tags?: string[];
}

export interface VoteInput {
  voter: string;
  choice: string;
  weight?: string | number | bigint;
  justification?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export interface VoteRecord {
  proposalId: string;
  voter: string;
  choice: string;
  weight: bigint;
  justification?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface ProposalOutcome {
  winningOptionId: string | null;
  tallies: Record<string, bigint>;
  totalWeight: bigint;
  totalVotes: number;
  tie: boolean;
  quorumReached: boolean;
  closedAt: number;
}

export interface Proposal {
  id: string;
  title: string;
  description?: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  status: ProposalStatus;
  options: ProposalOption[];
  votes: VoteRecord[];
  outcome?: ProposalOutcome;
  metadata?: Record<string, unknown>;
  quorum?: bigint;
  deadline?: number;
  tags?: string[];
}

export interface SerializedVoteRecord extends Omit<VoteRecord, 'weight'> {
  weight: string;
}

export interface SerializedProposalOutcome
  extends Omit<ProposalOutcome, 'tallies' | 'totalWeight'> {
  tallies: Record<string, string>;
  totalWeight: string;
}

export interface SerializedProposal
  extends Omit<Proposal, 'votes' | 'outcome' | 'quorum'> {
  votes: SerializedVoteRecord[];
  outcome?: SerializedProposalOutcome;
  quorum?: string;
}

export interface SerializedGovernanceState {
  proposals: SerializedProposal[];
}

const proposals: Proposal[] = [];

const toBigInt = (value: string | number | bigint | undefined, fallback: bigint) => {
  if (value === undefined) return fallback;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.round(value));
  if (/^0x/i.test(value)) return BigInt(value);
  if (/\./.test(value)) {
    return BigInt(Math.round(Number(value)));
  }
  return BigInt(value);
};

const cloneJson = <T>(value: T): T => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
};

const cloneProposal = (proposal: Proposal): Proposal => ({
  ...proposal,
  options: proposal.options.map((option) => ({ ...option, metadata: cloneJson(option.metadata) })),
  votes: proposal.votes.map((vote) => ({
    ...vote,
    weight: BigInt(vote.weight),
    metadata: cloneJson(vote.metadata),
  })),
  outcome: proposal.outcome
    ? {
        ...proposal.outcome,
        tallies: Object.fromEntries(
          Object.entries(proposal.outcome.tallies).map(([key, value]) => [key, BigInt(value)])
        ),
        totalWeight: BigInt(proposal.outcome.totalWeight),
      }
    : undefined,
  metadata: cloneJson(proposal.metadata),
  quorum: proposal.quorum === undefined ? undefined : BigInt(proposal.quorum),
  tags: proposal.tags ? [...proposal.tags] : undefined,
});

const requireProposal = (id: string) => {
  const proposal = proposals.find((entry) => entry.id === id);
  if (!proposal) {
    throw new Error(`Proposal ${id} not found`);
  }
  return proposal;
};

const ensureOptionExists = (proposal: Proposal, optionId: string) => {
  const exists = proposal.options.some((option) => option.id === optionId);
  if (!exists) {
    throw new Error(`Option ${optionId} does not exist for proposal ${proposal.id}`);
  }
};

const computeOutcome = (proposal: Proposal): ProposalOutcome => {
  const tallies: Record<string, bigint> = Object.fromEntries(
    proposal.options.map((option) => [option.id, 0n])
  );
  let totalWeight = 0n;
  let winningOptionId: string | null = null;
  let winningWeight = 0n;
  let tie = false;

  proposal.votes.forEach((vote) => {
    const weight = vote.weight < 0n ? 0n : vote.weight;
    tallies[vote.choice] = (tallies[vote.choice] ?? 0n) + weight;
    totalWeight += weight;
  });

  for (const [optionId, weight] of Object.entries(tallies)) {
    if (weight > winningWeight) {
      winningWeight = weight;
      winningOptionId = optionId;
      tie = false;
    } else if (weight === winningWeight && weight !== 0n && optionId !== winningOptionId) {
      tie = true;
    }
  }

  const quorum = proposal.quorum ?? 0n;
  const quorumReached = quorum === 0n ? true : totalWeight >= quorum;

  if (!quorumReached || winningWeight === 0n || tie) {
    winningOptionId = null;
  }

  return {
    winningOptionId,
    tallies,
    totalWeight,
    totalVotes: proposal.votes.length,
    tie,
    quorumReached,
    closedAt: Date.now(),
  };
};

export const createProposal = (author: string, draft: ProposalDraft): Proposal => {
  if (!draft?.title?.trim()) {
    throw new Error('Proposal title is required');
  }
  if (!draft.options || draft.options.length < 1) {
    throw new Error('Proposal must contain at least one option');
  }

  const now = Date.now();
  const proposalId = draft.id ?? randomUUID();
  const status: ProposalStatus = draft.status ?? 'draft';

  const options = draft.options.map((option, index) => ({
    id: option.id ?? `${proposalId}:${index + 1}`,
    label: option.label,
    description: option.description,
    metadata: cloneJson(option.metadata),
  }));

  const proposal: Proposal = {
    id: proposalId,
    title: draft.title,
    description: draft.description,
    author,
    createdAt: now,
    updatedAt: now,
    status,
    options,
    votes: [],
    metadata: cloneJson(draft.metadata),
    quorum: draft.quorum !== undefined ? toBigInt(draft.quorum, 0n) : undefined,
    deadline: draft.deadline,
    tags: draft.tags ? [...draft.tags] : undefined,
  };

  proposals.push(proposal);
  return cloneProposal(proposal);
};

export const activateProposal = (id: string): Proposal => {
  const proposal = requireProposal(id);
  if (proposal.status === 'cancelled') {
    throw new Error('Cannot activate a cancelled proposal');
  }
  if (proposal.status === 'closed') {
    throw new Error('Cannot activate a closed proposal');
  }
  proposal.status = 'active';
  proposal.updatedAt = Date.now();
  return cloneProposal(proposal);
};

export const cancelProposal = (id: string): Proposal => {
  const proposal = requireProposal(id);
  if (proposal.status === 'closed') {
    throw new Error('Cannot cancel a closed proposal');
  }
  proposal.status = 'cancelled';
  proposal.updatedAt = Date.now();
  return cloneProposal(proposal);
};

export const voteOnProposal = (proposalId: string, vote: VoteInput): VoteRecord => {
  const proposal = requireProposal(proposalId);
  if (proposal.status !== 'active') {
    throw new Error(`Proposal ${proposalId} is not active`);
  }
  ensureOptionExists(proposal, vote.choice);
  if (!vote.voter?.trim()) {
    throw new Error('Voter DID is required');
  }
  const weight = toBigInt(vote.weight, 1n);
  if (weight <= 0n) {
    throw new Error('Vote weight must be positive');
  }

  for (let i = 0; i < proposal.votes.length; i += 1) {
    if (proposal.votes[i]?.voter === vote.voter) {
      proposal.votes.splice(i, 1);
      break;
    }
  }

  const record: VoteRecord = {
    proposalId,
    voter: vote.voter,
    choice: vote.choice,
    weight,
    justification: vote.justification,
    metadata: cloneJson(vote.metadata),
    timestamp: vote.timestamp ?? Date.now(),
  };

  proposal.votes.push(record);
  proposal.updatedAt = Date.now();
  return { ...record };
};

export const closeProposal = (id: string): Proposal => {
  const proposal = requireProposal(id);
  if (proposal.status === 'cancelled') {
    throw new Error('Cancelled proposal cannot be closed');
  }
  if (proposal.status === 'closed') {
    return cloneProposal(proposal);
  }
  proposal.status = 'closed';
  proposal.outcome = computeOutcome(proposal);
  proposal.updatedAt = proposal.outcome.closedAt;
  return cloneProposal(proposal);
};

export const listProposals = (options: { status?: ProposalStatus } = {}): Proposal[] => {
  const { status } = options;
  const filtered = status ? proposals.filter((proposal) => proposal.status === status) : proposals;
  return filtered.map(cloneProposal).sort((a, b) => a.createdAt - b.createdAt);
};

export const getProposalById = (id: string): Proposal | undefined => {
  const proposal = proposals.find((entry) => entry.id === id);
  return proposal ? cloneProposal(proposal) : undefined;
};

export const resetGovernance = () => {
  proposals.length = 0;
};

export const exportGovernanceState = (): SerializedGovernanceState => ({
  proposals: proposals.map((proposal) => ({
    ...proposal,
    options: proposal.options.map((option) => ({ ...option })),
    votes: proposal.votes.map(({ weight, ...rest }) => ({ ...rest, weight: weight.toString() })),
    outcome: proposal.outcome
      ? {
          ...proposal.outcome,
          tallies: Object.fromEntries(
            Object.entries(proposal.outcome.tallies).map(([key, value]) => [key, value.toString()])
          ),
          totalWeight: proposal.outcome.totalWeight.toString(),
        }
      : undefined,
    metadata: cloneJson(proposal.metadata),
    quorum: proposal.quorum === undefined ? undefined : proposal.quorum.toString(),
    tags: proposal.tags ? [...proposal.tags] : undefined,
  })),
});

export const importGovernanceState = (state?: SerializedGovernanceState) => {
  proposals.length = 0;
  if (!state?.proposals) return;

  state.proposals.forEach((entry) => {
    const proposal: Proposal = {
      ...entry,
      options: entry.options.map((option) => ({ ...option })),
      votes: (entry.votes ?? []).map((vote) => ({
        ...vote,
        weight: BigInt(vote.weight),
        metadata: cloneJson(vote.metadata),
      })),
      outcome: entry.outcome
        ? {
            ...entry.outcome,
            tallies: Object.fromEntries(
              Object.entries(entry.outcome.tallies).map(([key, value]) => [key, BigInt(value)])
            ),
            totalWeight: BigInt(entry.outcome.totalWeight),
          }
        : undefined,
      metadata: cloneJson(entry.metadata),
      quorum: entry.quorum === undefined ? undefined : BigInt(entry.quorum),
      tags: entry.tags ? [...entry.tags] : undefined,
    };
    proposals.push(proposal);
  });
};
