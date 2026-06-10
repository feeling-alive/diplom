"""PatchTST architecture — exact copy of the training notebook definition.

The class hyperparameters and forward pass MUST stay byte-identical to the
training code: ``load_state_dict`` on ``app/ml/pytorch_model.pt`` only succeeds
when every layer name and shape matches.
"""

import torch
import torch.nn as nn


class PatchTST(nn.Module):
    def __init__(self, seq_len=60, patch_len=12, stride=6,
                 n_features=11, d_model=64, n_heads=4,
                 n_layers=2, d_ff=128, dropout=0.2):
        super().__init__()
        self.patch_len = patch_len
        self.stride = stride
        self.n_features = n_features
        self.num_patches = (seq_len - patch_len) // stride + 1

        self.patch_embed = nn.Linear(patch_len, d_model)
        self.pos_embed = nn.Parameter(
            torch.zeros(1, self.num_patches, d_model)
        )

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads, dim_feedforward=d_ff,
            dropout=dropout, batch_first=True, activation='gelu'
        )
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=n_layers
        )

        self.classifier = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(32, 2)
        )

    def forward(self, x):
        # x: (batch, seq_len=60, n_features=11)
        batch_size = x.shape[0]
        x = x.permute(0, 2, 1)  # (batch, 11, 60)
        patches = x.unfold(
            dimension=-1, size=self.patch_len, step=self.stride
        )  # (batch, 11, num_patches, patch_len)
        out = self.patch_embed(patches)   # (batch, 11, num_patches, d_model)
        out = out + self.pos_embed        # broadcast pos_embed
        out = out.reshape(
            batch_size * self.n_features, self.num_patches, -1
        )
        out = self.transformer_encoder(out)
        out = out.mean(dim=1)             # (batch*11, d_model)
        out = out.reshape(batch_size, self.n_features, -1)
        out = out.mean(dim=1)             # (batch, d_model)
        return self.classifier(out)
